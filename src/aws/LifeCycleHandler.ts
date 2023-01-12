import {
  AutoScalingClient,
  CompleteLifecycleActionCommand, DescribeAutoScalingInstancesCommand,
  DescribeLifecycleHooksCommand,
  LifecycleHook,
} from '@aws-sdk/client-auto-scaling';
import Context from '../types';
import Metadata from './Metadata';
import stopPM2Processes from '../pm2';

/**
 * Class to handle Terminating lifecycle hooks for AWS Autoscaling
 */
export default class LifecycleHandler {
  private client: AutoScalingClient;

  private readonly groupName: string | undefined;

  private readonly instanceId: string;

  private terminating: boolean;

  private timer: NodeJS.Timer | undefined;

  private metadata: Metadata;

  private readonly checkInterval: number;

  /**
   * Constructor
   * @param ctx The EC2 instance context
   * @param metadata The metadata instance
   * @param options
   */
  constructor(ctx: Context, metadata: Metadata, options?: { checkInterval: number; } | undefined) {
    this.instanceId = ctx.instanceId;
    this.client = new AutoScalingClient({ region: ctx.region });
    this.metadata = metadata || new Metadata();
    this.terminating = false;
    this.checkInterval = options?.checkInterval || 60000;
  }

  start() {
    this.timer = setInterval(async () => {
      try {
        await this.checkLifecycles();
      } catch (e) {
        const err = e as Error;
        console.error('Error handling lifecycle hooks: ', err.message);
      }
    }, this.checkInterval);
  }

  private stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Get the name of the autoscaling group this instance  is in
   */
  async getAutoScalingGroup(): Promise<string | undefined> {
    const command = new DescribeAutoScalingInstancesCommand({
      InstanceIds: [this.instanceId],
    });
    const result = await this.client.send(command);
    const instance = result.AutoScalingInstances?.[0];
    return instance?.AutoScalingGroupName || undefined;
  }

  /**
   * Check if there is a pending Terminating:Wait lifecycle
   * If so, stop all PM2 processes and complete the lifecycle hook
   */
  async checkLifecycles(): Promise<void> {
    if (await this.metadata.getLifecycleState() === 'Terminated') {
      this.stop();
      try {
        await stopPM2Processes();
      } catch (e) {
        // PM2 failed to stop processes, let's still continue and complete lifecycle hooks
        const err = e as Error;
        console.error('Error stopping PM2 processes: ', err.message);
      }
      const groupName = await this.getAutoScalingGroup();
      if (groupName) {
        const input = { AutoScalingGroupName: groupName };
        const command = new DescribeLifecycleHooksCommand(input);
        const result = await this.client.send(command);
        const hooks = result.LifecycleHooks ?? [];
        const hook = hooks.find((h: LifecycleHook) => h.LifecycleTransition === 'autoscaling:EC2_INSTANCE_TERMINATING');
        if (hook) {
          await this.completeLifecycleHook(hook);
        }
      }
    }
  }

  /**
   * Complete a lifecycle hook to continue with termination process
   * @param hook
   */
  async completeLifecycleHook(hook: LifecycleHook | undefined): Promise<void> {
    const input = {
      AutoScalingGroupName: this.groupName,
      LifecycleActionResult: 'CONTINUE',
      LifecycleHookName: hook?.LifecycleHookName,
      InstanceId: this.instanceId,
    };
    const command = new CompleteLifecycleActionCommand(input);
    await this.client.send(command);
  }
}
