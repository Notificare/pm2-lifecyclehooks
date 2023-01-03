import { AutoScalingClient, DescribeLifecycleHooksCommand, LifecycleHook } from "@aws-sdk/client-auto-scaling";
import { Context } from '../types';
import { getLifecycleState } from './metadata';
import { completeLifecycleHook } from './lifecycle_hooks';
import { stopPM2Process, getPM2ProcessList } from '../pm2';

export async function checkLifecycles(ctx: Context, conf: any): Promise<void> {
    getLifecycleState().then(async (state) => {
      console.log("Checking for Lifecycle Hooks...");
      console.log("Current Lifecycle State: ");

      const client = new AutoScalingClient({ region: ctx.region });
      const input = { AutoScalingGroupName: ctx.autoscalingGroupName };
      const command = new DescribeLifecycleHooksCommand(input);
      const result = await client.send(command);
      console.log(result);

      console.log(state);
      if (state == "Terminating:Wait") {
        console.log("Shutting down...");

        let hook: LifecycleHook|undefined = result.LifecycleHooks?.find((hook: any) => {
          return hook.LifecycleTransition === "autoscaling:EC2_INSTANCE_TERMINATING"
        });

        if (hook === undefined) {
          console.log("No Lifecycle Hook found, terminating...");
          return;
        }

        conf.workers_to_monitor.forEach((worker: string) => {
          console.log(worker);
          stopPM2Process(worker);

          setInterval((interval: any) => {
            if(getPM2ProcessList().join() != '') {
              completeLifecycleHook(ctx, hook);
              clearInterval(interval);
            }
          }, 1000)
        });
      } else if (state == "Pending:Wait") {
        console.log("Starting up, resolving Lifecycle Hook...");
        let hook = result.LifecycleHooks?.find(hook => {
          return hook.LifecycleTransition === "autoscaling:EC2_INSTANCE_LAUNCHING"
        });
        let procs = getPM2ProcessList();

        console.log(procs);

        procs = procs.filter((proc) => conf.workers_to_monitor.includes(proc));

        if(procs.sort().join() === conf.workers_to_monitor.sort().join()) {
          console.log("All processes running, resolving Lifecycle Hook...");
          completeLifecycleHook(ctx, hook);
        }
      }
      setTimeout(() => checkLifecycles(ctx, conf), 10000);
    })
}