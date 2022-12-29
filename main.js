const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");
const { AutoScalingClient, DescribeAutoScalingInstancesCommand, DescribeLifecycleHooksCommand} = require("@aws-sdk/client-auto-scaling");
const axios = require('axios');
const io = require('@pm2/io')

const conf = io.initModule()

// Default metadata endpoint for AWS
const metadataURL = "http://169.254.169.254"

async function isAWS() {
  return axios.get(`${metadataURL}/latest/meta-data/instance-id`).then((response) => {
    if (response.status == 200) {
      return true;
    }
  }).catch(function (err) {
    console.log("Unable to fetch -", err);
    return false;
  });
}

async function getMetadata(path) {
  return axios.get(`${metadataURL}/latest/metadata${path}`,
    {
      responseType: 'json',
    }).then((response) => {
      return response.data.toString();
    }).catch((err) => {
      console.log("Unable to fetch -", err);
    });
}

async function getAutoScalingGroup(ctx) {
  client = new AutoScalingClient({ region: ctx.region });
  const input = {
    InstanceIds: [ctx.instanceId]
  };
  const command = new DescribeAutoScalingInstancesCommand(input);
  result = await client.send(command);
  console.log(result);
  return result.AutoScalingInstances[0].AutoScalingGroupName;
}

async function getInstanceContext() {
  context = await axios.get(`${metadataURL}/latest/dynamic/instance-identity/document`).then((response) => {
    console.log(response.data);
    return {
      instanceId: response.data.instanceId,
      region: response.data.region,
    }
  });

  context.autoscalingGroupName = await getAutoScalingGroup(context);
  context.credentials = fromNodeProviderChain();
  return context
}

async function getLifecycleState() {
  return await getMetadata('/autoscaling/target-lifecycle-state').then((response) => {
    return response;
  }).catch((response) =>{
    if(response.status == 404) {
      console.log("Error retrieving lifecycle state");
    }
  });
}

async function checkLifecycles(ctx) {
    getLifecycleState().then(async (state) => {
      console.log("Checking for Lifecycle Hooks...");
      console.log("Current Lifecycle State: ");

      client = new AutoScalingClient({ region: ctx.region });
      const input = { AutoScalingGroupName: ctx.autoscalingGroupName };
      const command = new DescribeLifecycleHooksCommand(input);
      result = await client.send(command);
      console.log(result);

      console.log(state);
      if (state == "Terminating:Wait") {
        console.log("Shutting down...");

        hook = result.LifecycleHooks.find(hook => {
          return hook.LifecycleTransition === "autoscaling:EC2_INSTANCE_TERMINATING"
        });

      } else if (state == "Pending:Wait") {
        console.log("Starting up, resolving Lifecycle Hook...");
        hook = result.LifecycleHooks.find(hook => {
          return hook.LifecycleTransition === "autoscaling:EC2_INSTANCE_LAUNCHING"
        });
      }
      setTimeout(() => {
        checkLifecycles(ctx);
      }, 10000);
    })
}

async function main() {
  if (await isAWS()) {
    console.log('Currently running on EC2, continuing...');

    const ctx = await getInstanceContext()
    console.log(ctx)

    checkLifecycles(ctx)
  } else {
    console.log('Not running on EC2, waiting 10 seconds...');
    setTimeout(() => { main()}, 10000);
  }
}

main();