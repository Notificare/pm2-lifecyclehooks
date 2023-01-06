import pm2 from 'pm2';

export default function stopPM2Procs(): void {
  pm2.connect((err: Error) => {
    if (err) console.error(err);
    pm2.stop('all', (stopErr) => {
      pm2.disconnect();
      if (stopErr) throw stopErr;
    });
  });
}
