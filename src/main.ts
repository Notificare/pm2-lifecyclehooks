// Main entry point for the PM2 module
import pmx from '@pm2/io';
import { isAWS, getInstanceContext } from './aws/metadata';
import checkLifecycles from './aws/check_lifecycles';

pmx.initModule({}, () => {});

function main(): void {
  isAWS().then((response) => {
    if (response === true) {
      console.log('Currently running on EC2, continuing...');
      getInstanceContext().then((ctx) => checkLifecycles(ctx));
    } else {
      console.log('Not running on EC2, waiting 10 seconds...');
      setTimeout(() => main(), 5000);
    }
  });
}

main();
