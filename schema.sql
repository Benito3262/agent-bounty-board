CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  input TEXT NOT NULL,
  reward TEXT NOT NULL,            -- token base units (6 decimals)
  poster TEXT NOT NULL,            -- poster wallet (pays + rates)
  status TEXT NOT NULL DEFAULT 'open', -- open|claimed|delivered|paid|rated
  agent_id TEXT, worker TEXT,
  result TEXT, result_sha TEXT, preview TEXT,
  pay_tx TEXT, feedback_tx TEXT, score INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
  network TEXT NOT NULL, agent_id TEXT NOT NULL, owner TEXT NOT NULL, uri TEXT, name TEXT, skills TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (network, agent_id)
);
