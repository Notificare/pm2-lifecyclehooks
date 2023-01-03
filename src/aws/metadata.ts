import axios from 'axios';
import { AutoScalingClient, DescribeAutoScalingInstancesCommand} from "@aws-sdk/client-auto-scaling";
import { Context } from '../types';

const metadataURL = "http://169.254.169.254"

export async function getAWSMetadata( path : string ) : Promise<string> {
  return await axios.get(`${metadataURL}/latest/metadata${path}`,
    {
      responseType: 'json',
    }).then((response) => {
      return response.data.toString();
    }).catch((err) => {
      console.error("Unable to fetch -", err.message);
    });
}

export async function isAWS() : Promise<boolean|undefined> {
  const resp =  axios.get(`${metadataURL}/latest/meta-data/instance-id`).then((response) => {
    if (response.status == 200) {
      return true;
    }
  }).catch(function (err) {
    return false;
  });
  if (resp == undefined) return false;
}

export async function getLifecycleState()  {
  return await getAWSMetadata('/autoscaling/lifecycle').then((response) => {
    return response;
  }).catch((response) =>{
    if(response.status == 404) {
      console.log("Error retrieving lifecycle state");
    } else {
      console.log("Unknown error retrieving lifecycle state");
    }
  });
}

export async function getInstanceContext(): Promise<Context> {
  let context: Context = await axios.get(`${metadataURL}/latest/dynamic/instance-identity/document`).then((response) => {
    return {
      instanceId: response.data.instanceId,
      region: response.data.region
    }
  });

  context.autoscalingGroupName = await getAutoScalingGroup(context);
  return context
}

export async function getAutoScalingGroup(ctx: Context): Promise<string|undefined> {
  if (!ctx.instanceId) return;
  const client = new AutoScalingClient({
    region: ctx.region
  });
  const command = new DescribeAutoScalingInstancesCommand({
    InstanceIds: [ctx.instanceId]
  });
  const result = await client.send(command);
  if(result.AutoScalingInstances?.[0].AutoScalingGroupName) return result.AutoScalingInstances[0].AutoScalingGroupName;
}