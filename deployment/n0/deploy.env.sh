#!/usr/bin/env bash
# n0 deployment metadata (non-secret)
#
# This file is sourced by scripts. Keep it simple: just variable assignments.

# Install directory on target host
INSTALL_DIR=/data/numio

# Public base URL (used for external health checks)
BASE_URL=https://app.numio.ai

# AWS profile for deployment operations (ECR push, SSM secrets)
AWS_PROFILE=agenture-prod

# AWS region for SSM Parameter Store (target uses instance role)
AWS_REGION=us-east-1

