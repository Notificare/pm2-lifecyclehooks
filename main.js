const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");
const { AutoScalingClient, DescribeAutoScalingInstancesCommand, DescribeLifecycleHooksCommand, CompleteLifecycleActionCommand} = require("@aws-sdk/client-auto-scaling");
const axios = require('axios');
const pmx = require('pmx')
const pm2 = require('pm2')
const conf = pmx.initModule();

// Default metadata endpoint for AWS
const metadataURL = "http://169.254.169.254"

async function isAWS() {
  return axios.get(`${metadataURL}/latest/meta-data/instance-id`).then((response) => {
    if (response.status == 200) {
      return true;
    }
  }).catch(function (err) {
    return false;
  });
}

async function completeLifecycleHook(ctx, hook) {
  client = new AutoScalingClient({ region: ctx.region });
  const input = {
    AutoScalingGroupName: ctx.autoscalingGroupName,
    LifecycleActionResult: "CONTINUE",
    LifecycleHookName: hook.LifecycleHookName,
    InstanceId: ctx.instanceId
  };
  const command = new CompleteLifecycleActionCommand(input);
  result = await client.send(command);
  console.log(result);
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

async function stopPM2Process(processName) {
  pm2.connect(function(err) {
    if (err) {
      console.error(err);
      process.exit(2);
    }
    pm2.stop(processName, function(err, proc) {
      pm2.disconnect();
      if (err) {
        throw err;
      }
    });
  });
}

function getPM2ProcessList() {
  let procs;
  pm2.connect(function(err) {
    if (err) {
      console.error(err);
      process.exit(2);
    }
    pm2.list(function(err, list) {
      procs = list.filter((item) => {
        return item.pm2_env.pmx_module != true;
      }).map((item) => {
        return item.name;
      });

      console.log(procs);
      pm2.disconnect();
      if (err) {
        throw err;
      }
      return list
    });
  });
  return procs
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

        conf.workers_to_monitor.forEach((worker) => {
          console.log(worker);
          stopPM2Process(worker);

          setInterval(() => {
            if(getPM2ProcessList().join() != '') {
              completeLifecycleHook(ctx, hook);
              clearInterval(this);
            }
          }, 1000)
        });
      } else if (state == "Pending:Wait") {
        console.log("Starting up, resolving Lifecycle Hook...");
        hook = result.LifecycleHooks.find(hook => {
          return hook.LifecycleTransition === "autoscaling:EC2_INSTANCE_LAUNCHING"
        });
        const procs = getPM2ProcessList();

        console.log(procs);

        procs = procs.filter((proc) => {
          return conf.workers_to_monitor.includes(proc);
        });

        if(procs.sort().join() === conf.workers_to_monitor.sort().join()) {
          console.log("All processes running, resolving Lifecycle Hook...");
          completeLifecycleHook(ctx, hook);
        }
      }
      setTimeout(() => {
        checkLifecycles(ctx);
      }, 10000);
    })
}

async function main() {
  await isAWS().then(response => {
    if(response == true) {
    console.log('Currently running on EC2, continuing...');

    getInstanceContext().then(ctx => {
      checkLifecycles(ctx)
    });

    } else {
      console.log('Not running on EC2, waiting 10 seconds...');
      setTimeout(() => { main()}, 5000);
    }
  });
}

main();