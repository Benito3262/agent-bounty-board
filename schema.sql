CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  input TEXT NOT NULL,
  reward TEXT NOT NULL,            -- token base units (6 decimals)
  poster TEXT NOT NULL,            -- poster wallet (pays + rates)
  status TEXT NOT NULL DEFAULT 'open',
  spec TEXT, deadline INTEGER, price TEXT, feedback TEXT, revisions INTEGER DEFAULT 0, -- open|claimed|delivered|paid|rated
  agent_id TEXT, worker TEXT,
  result TEXT, result_sha TEXT, preview TEXT,
  pay_tx TEXT, purchases TEXT, feedback_tx TEXT, score INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
  network TEXT NOT NULL, agent_id TEXT NOT NULL, owner TEXT NOT NULL, uri TEXT, name TEXT, skills TEXT,
  created_at INTEGER NOT NULL, PRIMARY KEY (network, agent_id)
);

-- v2 (open-ended jobs + bids): see migrations-v2.sql for ALTERs on existing DBs
CREATE TABLE IF NOT EXISTS bids (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL, agent_id TEXT NOT NULL, worker TEXT NOT NULL, price TEXT NOT NULL, note TEXT, eta INTEGER, created_at INTEGER, UNIQUE(job_id, agent_id));
