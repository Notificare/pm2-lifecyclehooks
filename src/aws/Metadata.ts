import axios, { AxiosResponse } from 'axios';
import Context from '../types';

export default class Metadata {
  private readonly metadataURL: string;

  constructor(config?: { metadataURL: string; } | undefined) {
    this.metadataURL = config?.metadataURL || 'http://169.254.169.254';
  }

  async getAWSMetadata(path : string) : Promise<string | undefined> {
    try {
      const resp: AxiosResponse = await axios.get(
        `${this.metadataURL}/latest/meta-data${path}`,
        {
          timeout: 10000,
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

  async isAWS() : Promise<boolean> {
    try {
      const resp: AxiosResponse = await axios.get(`${this.metadataURL}/latest/meta-data/instance-id`, { timeout: 10000 });
      return resp.status === 200;
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

  async getLifecycleState(): Promise<string | undefined> {
    try {
      return await this.getAWSMetadata('/autoscaling/target-lifecycle-state');
    } catch (e: unknown) {
      const err = e as Error;
      console.error('Error retrieving lifecycle state', err.message);
      return undefined;
    }
  }

  async getInstanceContext(): Promise<Context> {
    const ctx = new Context();
    const resp = await axios.get(`${this.metadataURL}/latest/dynamic/instance-identity/document`, { timeout: 10000 });
    ctx.instanceId = resp.data.instanceId;
    ctx.region = resp.data.region;
    return ctx;
  }
}
