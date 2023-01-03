import pm2 from 'pm2';

export async function stopPM2Process(processName: string): Promise<void> {
  pm2.connect(function(err) {
    if (err) {
      console.error(err);
      process.exit(2);
    }
    pm2.stop(processName, function(err) {
      pm2.disconnect();
      if (err) {
        throw err;
      }
    });
  });
}

export function getPM2ProcessList(): Array<string|undefined> {
  let process_list: Array<string|undefined> = [];
  pm2.connect(function(err) {
    if (err) {
      console.error(err);
      process.exit(2);
    }
    pm2.list(function(err, list) {
      process_list = list.filter((item: any ) => {
        return item.pm2_env.pmx_module != true;
      }).map((item) => {
        return item.name;
      });

      pm2.disconnect();
      if (err) {
        throw err;
      }
      return list
    });
  });
  return process_list;
}
