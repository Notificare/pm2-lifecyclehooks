# pm2-lifecyclehooks

A PM2 module that checks (when its finished) for unresolved AWS EC2-Autoscaling Lifecycle hooks and resolves them according to the running processes.

The goal of this module is to resolve `INSTANCE_LAUNCHING` hooks when there are pm2 processes available, and to resolve `INSTANCE_TERMINATING` after the processes have gracefully stopped.
