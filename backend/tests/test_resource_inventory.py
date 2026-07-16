"""Integration tests for resource inventory sync.

Uses mocked AWS clients and a real PostgreSQL test database.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import func as sqlfunc
from sqlalchemy import select

from numio.core.resource_inventory_service import (
    _discover_ebs_volumes,
    _discover_ec2_instances,
    _discover_elastic_ips,
    _discover_lambda_functions,
    _discover_rds_instances,
    _discover_s3_buckets,
    _extract_tags,
    _mark_terminated,
    _run_resource_inventory_sync,
    _upsert_resources,
)
from numio.models.aws_account import AwsAccount
from numio.models.cloud_resource import CloudResource

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def test_account(db_session, default_workspace_id):
    """Create a test AWS account."""
    account = AwsAccount(
        id=uuid.uuid4(),
        workspace_id=default_workspace_id,
        aws_account_id="111111111111",
        alias="test-account",
        role_arn="arn:aws:iam::111111111111:role/NumioAccess",
        status="active",
        environment_label="production",
    )
    db_session.add(account)
    await db_session.flush()
    return account


# ---------------------------------------------------------------------------
# Unit tests: _extract_tags
# ---------------------------------------------------------------------------


class TestExtractTags:
    def test_empty_list(self):
        assert _extract_tags([]) == {}

    def test_standard_tags(self):
        tags = [{"Key": "Name", "Value": "my-server"}, {"Key": "Env", "Value": "prod"}]
        assert _extract_tags(tags) == {"Name": "my-server", "Env": "prod"}

    def test_skips_none_keys(self):
        tags = [{"Key": None, "Value": "x"}, {"Key": "Team", "Value": "data"}]
        assert _extract_tags(tags) == {"Team": "data"}


# ---------------------------------------------------------------------------
# Unit tests: EC2 discovery
# ---------------------------------------------------------------------------


class TestDiscoverEc2Instances:
    def _make_boto_session(self, instances: list[dict]):
        """Build a mocked boto3 session returning EC2 instances."""
        session = MagicMock()
        ec2 = MagicMock()
        session.client.return_value = ec2

        paginator = MagicMock()
        ec2.get_paginator.return_value = paginator
        paginator.paginate.return_value = [{"Reservations": [{"Instances": instances}]}]
        return session, ec2

    @pytest.mark.asyncio
    async def test_discovers_ec2_instances(self, db_session, test_account):
        instances = [
            {
                "InstanceId": "i-abc123",
                "State": {"Name": "running"},
                "InstanceType": "m5.large",
                "LaunchTime": datetime(2025, 6, 1, tzinfo=timezone.utc),
                "Tags": [{"Key": "Name", "Value": "web-server"}],
                "Platform": None,
                "VpcId": "vpc-123",
                "SubnetId": "subnet-456",
                "PrivateIpAddress": "10.0.1.5",
                "PublicIpAddress": "54.1.2.3",
            },
        ]
        boto_session, _ = self._make_boto_session(instances)

        now = datetime.now(timezone.utc)
        count, seen = await _discover_ec2_instances(
            boto_session,
            "111111111111",
            "us-east-1",
            db_session,
            now,
        )

        assert count == 1
        assert ("ec2", "i-abc123") in seen

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "i-abc123")
        )
        resource = result.scalar_one()
        assert resource.service == "ec2"
        assert resource.resource_type == "instance"
        assert resource.state == "running"
        assert resource.name == "web-server"
        assert resource.tags == {"Name": "web-server"}
        assert resource.resource_metadata["instance_type"] == "m5.large"


# ---------------------------------------------------------------------------
# Unit tests: S3 discovery
# ---------------------------------------------------------------------------


class TestDiscoverS3Buckets:
    def _make_boto_session(self, buckets: list[dict]):
        session = MagicMock()
        s3 = MagicMock()
        session.client.return_value = s3

        s3.list_buckets.return_value = {"Buckets": buckets}
        # Default: no tags, us-east-1
        from botocore.exceptions import ClientError

        s3.get_bucket_tagging.side_effect = ClientError(
            {"Error": {"Code": "NoSuchTagSet", "Message": ""}}, "GetBucketTagging"
        )
        s3.get_bucket_location.return_value = {"LocationConstraint": None}
        return session, s3

    @pytest.mark.asyncio
    async def test_discovers_s3_buckets(self, db_session, test_account):
        buckets = [
            {"Name": "my-data-bucket", "CreationDate": datetime(2025, 1, 15, tzinfo=timezone.utc)},
        ]
        boto_session, _ = self._make_boto_session(buckets)
        now = datetime.now(timezone.utc)

        count, seen = await _discover_s3_buckets(boto_session, "111111111111", db_session, now)

        assert count == 1
        assert ("s3", "my-data-bucket") in seen

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "my-data-bucket")
        )
        resource = result.scalar_one()
        assert resource.service == "s3"
        assert resource.resource_type == "bucket"
        assert resource.name == "my-data-bucket"


# ---------------------------------------------------------------------------
# Unit tests: EBS discovery
# ---------------------------------------------------------------------------


class TestDiscoverEbsVolumes:
    @pytest.mark.asyncio
    async def test_discovers_ebs_volumes(self, db_session, test_account):
        session = MagicMock()
        ec2 = MagicMock()
        session.client.return_value = ec2
        paginator = MagicMock()
        ec2.get_paginator.return_value = paginator
        paginator.paginate.return_value = [
            {
                "Volumes": [
                    {
                        "VolumeId": "vol-abc123",
                        "State": "in-use",
                        "Size": 100,
                        "VolumeType": "gp3",
                        "Iops": 3000,
                        "Encrypted": True,
                        "CreateTime": datetime(2025, 3, 1, tzinfo=timezone.utc),
                        "Tags": [{"Key": "Name", "Value": "data-vol"}],
                        "Attachments": [{"InstanceId": "i-abc123"}],
                    }
                ]
            }
        ]

        now = datetime.now(timezone.utc)
        count, seen = await _discover_ebs_volumes(
            session,
            "111111111111",
            "us-east-1",
            db_session,
            now,
        )

        assert count == 1
        assert ("ebs", "vol-abc123") in seen

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "vol-abc123")
        )
        resource = result.scalar_one()
        assert resource.service == "ebs"
        assert resource.resource_metadata["size_gb"] == 100
        assert resource.resource_metadata["attached_to"] == "i-abc123"


# ---------------------------------------------------------------------------
# Unit tests: Lambda discovery
# ---------------------------------------------------------------------------


class TestDiscoverLambdaFunctions:
    @pytest.mark.asyncio
    async def test_discovers_lambda_functions(self, db_session, test_account):
        session = MagicMock()
        lam = MagicMock()
        session.client.return_value = lam
        paginator = MagicMock()
        lam.get_paginator.return_value = paginator
        paginator.paginate.return_value = [
            {
                "Functions": [
                    {
                        "FunctionName": "my-processor",
                        "FunctionArn": (
                            "arn:aws:lambda:us-east-1:111111111111:function:my-processor"
                        ),
                        "Runtime": "python3.12",
                        "MemorySize": 256,
                        "Timeout": 30,
                        "Handler": "handler.main",
                        "CodeSize": 5000,
                        "LastModified": "2025-06-01T12:00:00Z",
                        "State": "Active",
                    }
                ]
            }
        ]
        lam.list_tags.return_value = {"Tags": {"Team": "data"}}

        now = datetime.now(timezone.utc)
        count, seen = await _discover_lambda_functions(
            session,
            "111111111111",
            "us-east-1",
            db_session,
            now,
        )

        assert count == 1
        assert ("lambda", "my-processor") in seen

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "my-processor")
        )
        resource = result.scalar_one()
        assert resource.service == "lambda"
        assert resource.tags == {"Team": "data"}
        assert resource.resource_metadata["runtime"] == "python3.12"


# ---------------------------------------------------------------------------
# Unit tests: Elastic IP discovery
# ---------------------------------------------------------------------------


class TestDiscoverElasticIps:
    @pytest.mark.asyncio
    async def test_discovers_elastic_ips(self, db_session, test_account):
        session = MagicMock()
        ec2 = MagicMock()
        session.client.return_value = ec2
        ec2.describe_addresses.return_value = {
            "Addresses": [
                {
                    "AllocationId": "eipalloc-abc123",
                    "PublicIp": "52.1.2.3",
                    "AssociationId": "eipassoc-xyz",
                    "InstanceId": "i-abc123",
                    "Tags": [],
                    "NetworkInterfaceId": "eni-123",
                }
            ]
        }

        now = datetime.now(timezone.utc)
        count, seen = await _discover_elastic_ips(
            session,
            "111111111111",
            "us-east-1",
            db_session,
            now,
        )

        assert count == 1
        assert ("eip", "eipalloc-abc123") in seen

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "eipalloc-abc123")
        )
        resource = result.scalar_one()
        assert resource.service == "eip"
        assert resource.state == "associated"


# ---------------------------------------------------------------------------
# Unit tests: RDS discovery
# ---------------------------------------------------------------------------


class TestDiscoverRdsInstances:
    @pytest.mark.asyncio
    async def test_discovers_rds_instances(self, db_session, test_account):
        session = MagicMock()
        rds = MagicMock()
        session.client.return_value = rds
        paginator = MagicMock()
        rds.get_paginator.return_value = paginator
        paginator.paginate.return_value = [
            {
                "DBInstances": [
                    {
                        "DBInstanceIdentifier": "mydb-prod",
                        "DBInstanceArn": "arn:aws:rds:us-east-1:111111111111:db:mydb-prod",
                        "DBInstanceStatus": "available",
                        "Engine": "postgres",
                        "EngineVersion": "15.4",
                        "DBInstanceClass": "db.r6g.large",
                        "MultiAZ": True,
                        "StorageType": "gp3",
                        "AllocatedStorage": 100,
                        "InstanceCreateTime": datetime(2025, 2, 1, tzinfo=timezone.utc),
                    }
                ]
            }
        ]
        rds.list_tags_for_resource.return_value = {"TagList": [{"Key": "Env", "Value": "prod"}]}

        now = datetime.now(timezone.utc)
        count, seen = await _discover_rds_instances(
            session,
            "111111111111",
            "us-east-1",
            db_session,
            now,
        )

        assert count == 1
        assert ("rds", "mydb-prod") in seen

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "mydb-prod")
        )
        resource = result.scalar_one()
        assert resource.service == "rds"
        assert resource.state == "available"
        assert resource.resource_metadata["engine"] == "postgres"
        assert resource.tags == {"Env": "prod"}


# ---------------------------------------------------------------------------
# Integration tests: upsert idempotency
# ---------------------------------------------------------------------------


class TestUpsertResources:
    @pytest.mark.asyncio
    async def test_upsert_creates_resource(self, db_session, test_account):
        now = datetime.now(timezone.utc)
        resources = [
            {
                "account_id": "111111111111",
                "region": "us-east-1",
                "service": "ec2",
                "resource_type": "instance",
                "resource_id": "i-upsert-test",
                "arn": "arn:aws:ec2:us-east-1:111111111111:instance/i-upsert-test",
                "name": "test-server",
                "state": "running",
                "creation_date": now,
                "tags": {"Name": "test-server"},
                "metadata": {"instance_type": "t3.micro"},
            }
        ]

        count = await _upsert_resources(db_session, "111111111111", resources, now)
        assert count == 1

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "i-upsert-test")
        )
        resource = result.scalar_one()
        assert resource.state == "running"

    @pytest.mark.asyncio
    async def test_upsert_updates_existing(self, db_session, test_account):
        """Re-syncing the same resource updates it without creating a duplicate."""
        now = datetime.now(timezone.utc)
        resources = [
            {
                "account_id": "111111111111",
                "region": "us-east-1",
                "service": "ec2",
                "resource_type": "instance",
                "resource_id": "i-dup-test",
                "name": "original",
                "state": "running",
                "creation_date": now,
                "tags": None,
                "metadata": None,
            }
        ]
        await _upsert_resources(db_session, "111111111111", resources, now)

        # Re-upsert with updated state
        resources[0]["state"] = "stopped"
        resources[0]["name"] = "updated"
        await _upsert_resources(db_session, "111111111111", resources, now)

        total = await db_session.execute(
            select(sqlfunc.count())
            .select_from(CloudResource)
            .where(CloudResource.resource_id == "i-dup-test")
        )
        assert total.scalar() == 1

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "i-dup-test")
        )
        resource = result.scalar_one()
        assert resource.state == "stopped"
        assert resource.name == "updated"


# ---------------------------------------------------------------------------
# Integration tests: terminated resource detection
# ---------------------------------------------------------------------------


class TestMarkTerminated:
    @pytest.mark.asyncio
    async def test_marks_missing_resources_as_terminated(self, db_session, test_account):
        now = datetime.now(timezone.utc)

        # Create two resources
        resources = [
            {
                "account_id": "111111111111",
                "region": "us-east-1",
                "service": "ec2",
                "resource_type": "instance",
                "resource_id": "i-alive",
                "name": "alive",
                "state": "running",
                "creation_date": now,
                "tags": None,
                "metadata": None,
            },
            {
                "account_id": "111111111111",
                "region": "us-east-1",
                "service": "ec2",
                "resource_type": "instance",
                "resource_id": "i-gone",
                "name": "gone",
                "state": "running",
                "creation_date": now,
                "tags": None,
                "metadata": None,
            },
        ]
        await _upsert_resources(db_session, "111111111111", resources, now)

        # Only i-alive was seen in the current sync
        seen_keys = {("ec2", "i-alive")}
        terminated_count = await _mark_terminated(db_session, "111111111111", seen_keys, now)
        assert terminated_count == 1

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "i-gone")
        )
        resource = result.scalar_one()
        assert resource.terminated_at is not None
        assert resource.state == "terminated"

        # i-alive should NOT be terminated
        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "i-alive")
        )
        resource = result.scalar_one()
        assert resource.terminated_at is None
        assert resource.state == "running"

    @pytest.mark.asyncio
    async def test_reappeared_resource_cleared_termination(self, db_session, test_account):
        """If a terminated resource reappears, upsert clears terminated_at."""
        now = datetime.now(timezone.utc)

        # Create and terminate a resource
        resources = [
            {
                "account_id": "111111111111",
                "region": "us-east-1",
                "service": "ec2",
                "resource_type": "instance",
                "resource_id": "i-reappear",
                "name": "reappear",
                "state": "running",
                "creation_date": now,
                "tags": None,
                "metadata": None,
            },
        ]
        await _upsert_resources(db_session, "111111111111", resources, now)
        await _mark_terminated(db_session, "111111111111", set(), now)

        # Verify terminated
        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "i-reappear")
        )
        assert result.scalar_one().terminated_at is not None

        # Re-upsert (resource reappears)
        await _upsert_resources(db_session, "111111111111", resources, now)

        result = await db_session.execute(
            select(CloudResource).where(CloudResource.resource_id == "i-reappear")
        )
        resource = result.scalar_one()
        assert resource.terminated_at is None


# ---------------------------------------------------------------------------
# Integration test: full sync with mocked AWS
# ---------------------------------------------------------------------------


class TestFullSync:
    @pytest.mark.asyncio
    async def test_full_sync_runs_all_services(self, db_session, test_account):
        """Full sync discovers resources across all service types."""
        now = datetime(2026, 3, 25, 12, 0, 0, tzinfo=timezone.utc)

        # Build a mock boto session that returns different resources per client
        def _make_client(service_name, region_name=None):
            client = MagicMock()
            if service_name == "ec2":
                paginator_instances = MagicMock()
                paginator_instances.paginate.return_value = [
                    {
                        "Reservations": [
                            {
                                "Instances": [
                                    {
                                        "InstanceId": f"i-{region_name}",
                                        "State": {"Name": "running"},
                                        "InstanceType": "t3.micro",
                                        "Tags": [],
                                        "LaunchTime": now,
                                        "Platform": None,
                                        "VpcId": None,
                                        "SubnetId": None,
                                        "PrivateIpAddress": None,
                                        "PublicIpAddress": None,
                                    }
                                ]
                            }
                        ]
                    }
                ]
                paginator_volumes = MagicMock()
                paginator_volumes.paginate.return_value = [{"Volumes": []}]

                def _get_paginator(op):
                    if op == "describe_instances":
                        return paginator_instances
                    return paginator_volumes

                client.get_paginator.side_effect = _get_paginator
                client.describe_addresses.return_value = {"Addresses": []}

            elif service_name == "rds":
                paginator = MagicMock()
                paginator.paginate.return_value = [{"DBInstances": []}]
                client.get_paginator.return_value = paginator

            elif service_name == "lambda":
                paginator = MagicMock()
                paginator.paginate.return_value = [{"Functions": []}]
                client.get_paginator.return_value = paginator

            elif service_name == "s3":
                client.list_buckets.return_value = {
                    "Buckets": [
                        {"Name": "test-bucket", "CreationDate": now},
                    ]
                }
                from botocore.exceptions import ClientError

                client.get_bucket_tagging.side_effect = ClientError(
                    {"Error": {"Code": "NoSuchTagSet", "Message": ""}},
                    "GetBucketTagging",
                )
                client.get_bucket_location.return_value = {"LocationConstraint": None}

            return client

        boto_session = MagicMock()
        boto_session.client.side_effect = _make_client

        with (
            patch("numio.core.resource_inventory_service.validate_connectivity") as mock_sts,
            patch("numio.core.resource_inventory_service.get_boto_session") as mock_get_session,
        ):
            mock_sts.return_value = (
                True,
                None,
                {"AccessKeyId": "x", "SecretAccessKey": "y", "SessionToken": "z"},
            )
            mock_get_session.return_value = boto_session

            count = await _run_resource_inventory_sync("111111111111", db_session)

        # Should have at least 1 S3 bucket + EC2 instances across regions
        assert count > 0

        # Verify S3 bucket was stored
        result = await db_session.execute(
            select(CloudResource).where(
                CloudResource.resource_id == "test-bucket",
                CloudResource.service == "s3",
            )
        )
        assert result.scalar_one_or_none() is not None

    @pytest.mark.asyncio
    async def test_sts_failure_raises(self, db_session, test_account):
        """STS failure raises RuntimeError."""
        with patch("numio.core.resource_inventory_service.validate_connectivity") as mock_sts:
            mock_sts.return_value = (False, "Access denied", None)
            with pytest.raises(RuntimeError, match="STS AssumeRole failed"):
                await _run_resource_inventory_sync("111111111111", db_session)

    @pytest.mark.asyncio
    async def test_account_not_found_raises(self, db_session):
        """Non-existent account raises ValueError."""
        with pytest.raises(ValueError, match="not found"):
            await _run_resource_inventory_sync("999999999999", db_session)
