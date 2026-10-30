CREATE TABLE IF NOT EXISTS leaderboard (
  player_id TEXT PRIMARY KEY NOT NULL,
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 2 AND 16),
  score INTEGER NOT NULL CHECK (score >= 0),
  stage INTEGER NOT NULL CHECK (stage >= 1),
  seconds INTEGER NOT NULL CHECK (seconds >= 1),
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leaderboard_rank_idx
  ON leaderboard(score DESC, stage DESC, seconds ASC, updated_at ASC);