const db = require('../db');
const suppressions = require('./suppressions');

function getOverview() {
  const { total, addedThisWeek, reasonCounts } = suppressions.getStats();

  const lookupsToday = db.prepare(`
    SELECT COUNT(*) AS c FROM check_batch_results r
    JOIN check_batches b ON b.id = r.batch_id
    WHERE date(b.created_at) = date('now')
  `).get().c;

  const last30 = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.reason IN ('hard_bounce', 'soft_bounce') THEN 1 ELSE 0 END) AS bounced
    FROM check_batch_results r
    JOIN check_batches b ON b.id = r.batch_id
    WHERE b.created_at >= datetime('now', '-30 days')
  `).get();
  const bounceRate30d = last30.total > 0 ? Math.round((last30.bounced / last30.total) * 10000) / 100 : 0;

  const listsCleaned = db.prepare("SELECT COUNT(*) AS c FROM import_jobs WHERE status = 'complete'").get().c;
  const jobsRunning = db.prepare("SELECT COUNT(*) AS c FROM import_jobs WHERE status = 'processing'").get().c;

  return {
    totalSuppressed: total,
    addedThisWeek,
    lookupsToday,
    bounceRate30d,
    listsCleaned,
    jobsRunning,
    reasonCounts,
  };
}

module.exports = { getOverview };
