// Main entry point for the PM2 module

// Local imports
import { isAWS, getInstanceContext } from './aws/metadata';
import { checkLifecycles } from "./aws/check_lifecycles";

// Intialize PM2 module
const pmx = require('pmx'); // Outdated, but package has no types
const conf: any = pmx.initModule();

async function main(): Promise<void> {
  await isAWS().then(response => {
    if(response == true) {
    console.log('Currently running on EC2, continuing...');

    getInstanceContext().then(ctx => checkLifecycles(ctx, conf));

    } else {
      console.log('Not running on EC2, waiting 10 seconds...');
      setTimeout(() => main(), 5000);
    }
  });
}

main();