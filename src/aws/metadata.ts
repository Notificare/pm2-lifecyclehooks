import axios, { AxiosResponse } from 'axios';
import { AutoScalingClient, DescribeAutoScalingInstancesCommand } from '@aws-sdk/client-auto-scaling';
import Context from '../types';

const metadataURL = 'http://169.254.169.254';

export async function getAWSMetadata(path : string) : Promise<string | undefined> {
  try {
    const resp: AxiosResponse = await axios.get(
      `${metadataURL}/latest/metadata${path}`,
      {
        responseType: 'json',
      },
    );
    return resp.data.toString();
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err?.response?.status === 404) {
        console.error('Error retrieving metadata', err.message);
      } else {
        console.error('Unknown error retrieving metadata', err.message);
      }
    }
    return undefined;
  }
}

export async function isAWS() : Promise<boolean> {
  try {
    const resp: AxiosResponse = await axios.get(`${metadataURL}/latest/meta-data/instance-id`);
    if (resp.status === 200) return true;
    return false;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err?.response?.status === 404) {
        console.error('Error retrieving metadata', err.message);
      } else {
        console.error('Unable to fetch -', err.message);
      }
    }
    return false;
  }
}

export async function getLifecycleState(): Promise<string | undefined> {
  try {
    const resp: string | undefined = await getAWSMetadata('/autoscaling/lifecycle');
    if (resp) return resp;
    return undefined;
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Error retrieving lifecycle state', err.message);
  }
  return undefined;
}

export async function getAutoScalingGroup(ctx: Context): Promise<string | undefined> {
  if (!ctx.instanceId) throw new Error('Instance ID not set');
  let groupName: string | undefined;

  const client = new AutoScalingClient({
    region: ctx.region,
  });
  const command = new DescribeAutoScalingInstancesCommand({
    InstanceIds: [ctx.instanceId],
  });

  try {
    const result = await client.send(command);
    const instance = result.AutoScalingInstances?.[0];

    if (instance && instance.AutoScalingGroupName !== undefined) {
      groupName = instance.AutoScalingGroupName;
    }
    return groupName;
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Error retrieving scaling group', err.message);
    return undefined;
  }
}

export async function getInstanceContext(): Promise<Context> {
  const ctx = new Context();
  try {
    const resp = await axios.get(`${metadataURL}/latest/dynamic/instance-identity/document`);
    ctx.instanceId = resp.data.instanceId;
    ctx.region = resp.data.region;
    return ctx;
  } catch (e: unknown) {
    const err = e as Error;
    console.error('Error retrieving instance context', err.message);
  }
  return ctx;
}
