import { AutoScalingClient, CompleteLifecycleActionCommand, LifecycleHook } from "@aws-sdk/client-auto-scaling";
import { Context } from '../types';


export async function completeLifecycleHook(ctx: Context, hook: LifecycleHook|undefined): Promise<void> {
  const client = new AutoScalingClient({ region: ctx.region });
  const input = {
    AutoScalingGroupName: ctx.autoscalingGroupName,
    LifecycleActionResult: "CONTINUE",
    LifecycleHookName: hook?.LifecycleHookName,
    InstanceId: ctx.instanceId
  };
  const command = new CompleteLifecycleActionCommand(input);
  const result = await client.send(command);
  console.log(result);
}