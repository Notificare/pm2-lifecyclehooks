import pm2 from 'pm2';

export default async function stopPM2Processes(): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
      } else {
        pm2.stop('all', (stopErr) => {
          pm2.disconnect();
          if (stopErr) {
            reject(stopErr);
          } else {
            resolve();
          }
        });
      }
    });
  });
}
