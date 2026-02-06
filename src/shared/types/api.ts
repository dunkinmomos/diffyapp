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

export type LeaderboardResponse = {
  type: 'leaderboard';
  day: string;
  entries: LeaderboardEntry[];
};

export type LeaderboardUpdateResponse = {
  type: 'leaderboard_update';
  day: string;
  entries: LeaderboardEntry[];
};
