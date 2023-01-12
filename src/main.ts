// Main entry point for the PM2 module
import pmx from '@pm2/io';
import Metadata from './aws/Metadata';
import LifecycleHandler from './aws/LifeCycleHandler';

function main(): void {
  const metadata = new Metadata();
  metadata.isAWS().then((response) => {
    if (response) {
      console.log('Currently running on EC2, continuing...');
      metadata.getInstanceContext().then((ctx) => {
        const lifecycleHandler = new LifecycleHandler(ctx, metadata);
        lifecycleHandler.start();
      }).catch((err) => {
        console.log('Failed to get instance context: ', err.message);
        setTimeout(() => main(), 10000);
      });
    } else {
      console.log('Not running on EC2, waiting 10 seconds...');
      setTimeout(() => main(), 10000);
    }
  });
}

pmx.initModule({});
main();
