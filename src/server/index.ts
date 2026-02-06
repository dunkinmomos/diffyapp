import express from 'express';
import {
  InitResponse,
  IncrementResponse,
  DecrementResponse,
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardUpdateResponse,
} from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

const getLeaderboardDay = () => new Date().toISOString().slice(0, 10);

const getIsoWeekKey = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

const getLeaderboardKey = (period: LeaderboardPeriod) => {
  const now = new Date();
  switch (period) {
    case 'daily':
      return `leaderboard:daily:${getLeaderboardDay()}`;
    case 'weekly':
      return `leaderboard:weekly:${getIsoWeekKey(now)}`;
    case 'monthly':
      return `leaderboard:monthly:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    case 'overall':
      return 'leaderboard:overall';
  }
};

const getSecondsUntilNextPeriod = (period: LeaderboardPeriod) => {
  const now = new Date();
  if (period === 'overall') return null;

  if (period === 'daily') {
    const nextUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    return Math.max(60, Math.floor((nextUtcMidnight.getTime() - now.getTime()) / 1000));
  }

  if (period === 'weekly') {
    const utcDay = now.getUTCDay() || 7;
    const daysUntilNextWeek = 8 - utcDay;
    const nextWeekStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilNextWeek)
    );
    return Math.max(60, Math.floor((nextWeekStart.getTime() - now.getTime()) / 1000));
  }

  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(60, Math.floor((nextMonthStart.getTime() - now.getTime()) / 1000));
};

const fetchLeaderboardEntries = async (period: LeaderboardPeriod) => {
  const leaderboardKey = getLeaderboardKey(period);
  const entries = await redis.zRange(leaderboardKey, 0, '+inf', {
    by: 'score',
    reverse: true,
    limit: { offset: 0, count: 10 },
  });

  return entries.map((entry) => ({
    username: entry.member,
    score: entry.score,
  }));
};

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

router.get<unknown, LeaderboardResponse | { status: string; message: string }>(
  '/api/leaderboard',
  async (_req, res): Promise<void> => {
    try {
      const periodParam = _req.query?.period;
      const period =
        periodParam === 'weekly' || periodParam === 'monthly' || periodParam === 'overall'
          ? periodParam
          : 'daily';
      const entries = await fetchLeaderboardEntries(period);

      res.json({
        type: 'leaderboard',
        period,
        day: getLeaderboardDay(),
        entries,
      });
    } catch (error) {
      console.error('Leaderboard fetch error:', error);
      let errorMessage = 'Failed to load leaderboard';
      if (error instanceof Error) {
        errorMessage = `Leaderboard fetch failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<
  unknown,
  LeaderboardUpdateResponse | { status: string; message: string },
  { score?: number; period?: LeaderboardPeriod | 'all' }
>(
  '/api/leaderboard',
  async (req, res): Promise<void> => {
    const score = Number(req.body?.score ?? 0);
    if (!Number.isFinite(score) || score <= 0) {
      res.status(400).json({
        status: 'error',
        message: 'score must be a positive number',
      });
      return;
    }

    try {
      const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
      const periodParam = req.body?.period ?? 'daily';
      const periods: LeaderboardPeriod[] =
        periodParam === 'all' ? ['daily', 'weekly', 'monthly', 'overall'] : [periodParam];

      for (const period of periods) {
        const leaderboardKey = getLeaderboardKey(period);
        const existingScore = await redis.zScore(leaderboardKey, username);
        if (existingScore === undefined || score > existingScore) {
          await redis.zAdd(leaderboardKey, { member: username, score });
          const expireSeconds = getSecondsUntilNextPeriod(period);
          if (expireSeconds) {
            await redis.expire(leaderboardKey, expireSeconds);
          }
        }
      }

      const responsePeriod = periodParam === 'all' ? 'daily' : periodParam;
      const entries = await fetchLeaderboardEntries(responsePeriod);

      res.json({
        type: 'leaderboard_update',
        period: responsePeriod,
        day: getLeaderboardDay(),
        entries,
      });
    } catch (error) {
      console.error('Leaderboard update error:', error);
      let errorMessage = 'Failed to update leaderboard';
      if (error instanceof Error) {
        errorMessage = `Leaderboard update failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
