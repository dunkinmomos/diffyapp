export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type LeaderboardEntry = {
  username: string;
  score: number;
};

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'overall';

export type LeaderboardResponse = {
  type: 'leaderboard';
  period: LeaderboardPeriod;
  day: string;
  entries: LeaderboardEntry[];
};

export type LeaderboardUpdateResponse = {
  type: 'leaderboard_update';
  period: LeaderboardPeriod;
  day: string;
  entries: LeaderboardEntry[];
};
