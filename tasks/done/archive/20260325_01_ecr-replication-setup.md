---
task: Configure ECR Cross-Region Replication
description: Configure ECR Cross-Region Replication
status: done
---


## Summary

Configure AWS ECR replication to automatically replicate container images from us-east-1 to other regions. This eliminates the need for multi-region push from CI/CD and resolves Docker credential issues on developer machines.

## Background

Currently, the numio build script pushes images to 4 ECR regions sequentially. This approach has issues:
- Docker Desktop on macOS corrupts local image tags during multi-region pushes
- Sequential pushes are slow
- More complex CI/CD logic

With ECR replication, we push once to us-east-1 and AWS handles distribution.

## Requirements

### Source Region
- **us-east-1** (primary push target)

### Destination Regions
- us-east-2
- us-west-1
- us-west-2

### Repositories to Replicate
- `numio-srv` (backend service)
- `numio-ui` (frontend service)

### AWS Account
- 257984537670

## AWS Configuration Needed

### 1. ECR Replication Configuration

Create a replication configuration on the ECR private registry in us-east-1:

```
Source: us-east-1
Destinations: us-east-2, us-west-1, us-west-2
Repository filter: PREFIX_MATCH "numio-"
```

Equivalent AWS CLI (for reference):
```bash
aws ecr put-replication-configuration \
  --replication-configuration '{
    "rules": [{
      "destinations": [
        {"region": "us-east-2", "registryId": "257984537670"},
        {"region": "us-west-1", "registryId": "257984537670"},
        {"region": "us-west-2", "registryId": "257984537670"}
      ],
      "repositoryFilters": [
        {"filter": "numio-", "filterType": "PREFIX_MATCH"}
      ]
    }]
  }' \
  --region us-east-1
```

### 2. Verify ECR Repositories Exist

Ensure these repositories exist in ALL 4 regions:
- `numio-srv`
- `numio-ui`

(They should already exist from current setup)

### 3. IAM Permissions

The replication service needs permissions to write to destination registries. This is typically handled automatically by AWS when replication is configured within the same account, but verify:
- ECR service-linked role exists
- Cross-region replication permissions are in place

## Verification

After configuration, verify replication works:

1. Push a test image to us-east-1:
   ```bash
   docker tag alpine:latest 257984537670.dkr.ecr.us-east-1.amazonaws.com/numio-srv:replication-test
   docker push 257984537670.dkr.ecr.us-east-1.amazonaws.com/numio-srv:replication-test
   ```

2. Wait 1-2 minutes, then check destination regions:
   ```bash
   aws ecr describe-images --repository-name numio-srv --image-ids imageTag=replication-test --region us-east-2
   aws ecr describe-images --repository-name numio-srv --image-ids imageTag=replication-test --region us-west-1
   aws ecr describe-images --repository-name numio-srv --image-ids imageTag=replication-test --region us-west-2
   ```

3. Clean up test image after verification

## Notes

- Replication is **eventual** (typically seconds to a few minutes)
- Replication is one-way (us-east-1 → other regions)
- Deleting an image in us-east-1 does NOT delete replicas
- No additional costs for replication itself (standard ECR storage/transfer costs apply)

## References

- [ECR Private Registry Replication](https://docs.aws.amazon.com/AmazonECR/latest/userguide/replication.html)
- [Terraform aws_ecr_replication_configuration](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecr_replication_configuration)
