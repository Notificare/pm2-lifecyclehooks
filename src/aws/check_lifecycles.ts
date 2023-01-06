import { AutoScalingClient, DescribeLifecycleHooksCommand, LifecycleHook } from '@aws-sdk/client-auto-scaling';
import Context from '../types';
import { getLifecycleState } from './metadata';
import completeLifecycleHook from './lifecycle_hooks';
import stopPM2Procs from '../pm2';

export default async function checkLifecycles(ctx: Context): Promise<void> {
  let state: string | undefined;
  try {
    state = await getLifecycleState();

    const client = new AutoScalingClient({ region: ctx.region });
    const input = { AutoScalingGroupName: ctx.autoscalingGroupName };
    const command = new DescribeLifecycleHooksCommand(input);
    let hooks: LifecycleHook[];

    try {
      const result = await client.send(command);
      hooks = result.LifecycleHooks ?? [];
    } catch (e: unknown) {
      const err = e as Error;
      console.error('Error retrieving lifecycle hooks', err.message);
      return;
    }

    if (state === 'Terminating:Wait') {
      const hook = hooks.find((h: LifecycleHook) => h.LifecycleTransition === 'autoscaling:EC2_INSTANCE_TERMINATING');
      completeLifecycleHook(ctx, hook);
      stopPM2Procs();
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Error retrieving lifecycle state', err.message);
  }
  setTimeout(() => checkLifecycles(ctx), 10000);
}
