"""Tests for the AWS onboarding CloudFormation template generator."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
import yaml
from httpx import ASGITransport, AsyncClient

from numio.onboarding.cfn_template import (
    CFN_OWNERSHIP_NOTICE,
    DEFAULT_REGION,
    LABEL_REGEX_STR,
    ROLE_NAME_PREFIX,
    STACK_NAME_PREFIX,
    USER_NAME_PREFIX,
    LabelValidationError,
    TemplateParameters,
    build_launch_url,
    render_template,
    role_name_for,
    stack_name_for,
    user_name_for,
    validate_label,
)

SAMPLE_EXTERNAL_ID = "11111111-2222-3333-4444-555555555555"
SAMPLE_LABEL = "wkt-aws-onboarding"


def _params(**overrides) -> TemplateParameters:
    """Build a TemplateParameters with sane defaults; tests override fields."""
    base = {
        "external_id": SAMPLE_EXTERNAL_ID,
        "label": SAMPLE_LABEL,
    }
    base.update(overrides)
    return TemplateParameters(**base)


# ---------------------------------------------------------------------------
# Pure template rendering
# ---------------------------------------------------------------------------


class TestRenderTemplate:
    def test_produces_valid_yaml(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        assert doc["AWSTemplateFormatVersion"] == "2010-09-09"
        assert isinstance(doc["Resources"], dict)

    def test_embeds_external_id_as_parameter_default(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        assert doc["Parameters"]["WorkspaceExternalId"]["Default"] == SAMPLE_EXTERNAL_ID

    def test_role_trust_policy_binds_external_id(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        trust = doc["Resources"]["NumioCurReaderRole"]["Properties"]["AssumeRolePolicyDocument"]
        assert trust["Statement"][0]["Condition"] == {
            "StringEquals": {"sts:ExternalId": {"Ref": "WorkspaceExternalId"}}
        }

    def test_role_trusts_service_user(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        principal = doc["Resources"]["NumioCurReaderRole"]["Properties"][
            "AssumeRolePolicyDocument"
        ]["Statement"][0]["Principal"]
        assert principal == {"AWS": {"Fn::GetAtt": ["NumioServiceUser", "Arn"]}}

    def test_user_name_includes_label(self):
        body = render_template(_params(label="abc123"))
        doc = yaml.safe_load(body)
        assert (
            doc["Resources"]["NumioServiceUser"]["Properties"]["UserName"]
            == "NumioServiceUser-Cfn-abc123"
        )

    def test_role_name_includes_label(self):
        body = render_template(_params(label="abc123"))
        doc = yaml.safe_load(body)
        assert (
            doc["Resources"]["NumioCurReaderRole"]["Properties"]["RoleName"]
            == "NumioCurReaderRole-Cfn-abc123"
        )

    def test_outputs_include_role_and_keys_and_external_id(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        outputs = doc["Outputs"]
        assert {
            "RoleArn",
            "AccessKeyId",
            "SecretAccessKey",
            "ExternalId",
            "AwsAccountId",
        } <= set(outputs.keys())

    def test_no_secrets_embedded_beyond_external_id(self):
        """The template must not bake in any long-lived credentials."""
        body = render_template(_params())
        # AKIA and ASIA are AWS access key prefixes; neither should appear.
        assert "AKIA" not in body
        assert "ASIA" not in body
        # Raw arns for numio's own side should not leak into tenant template.
        assert "arn:aws:iam::000000000000" not in body

    def test_prefills_cur_parameters(self):
        body = render_template(
            _params(
                cur_bucket_name="numio-cur-123456789012",
                cur_report_name="numio-report",
                cur_path_prefix="cur/daily",
            )
        )
        doc = yaml.safe_load(body)
        assert doc["Parameters"]["CurBucketName"]["Default"] == "numio-cur-123456789012"
        assert doc["Parameters"]["CurReportName"]["Default"] == "numio-report"
        assert doc["Parameters"]["CurPathPrefix"]["Default"] == "cur/daily"

    def test_s3_bucket_actions_present(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        policies = doc["Resources"]["NumioCurReaderRole"]["Properties"]["Policies"]
        statements = policies[0]["PolicyDocument"]["Statement"]
        cur_stmt = next(s for s in statements if s["Sid"] == "CurBucketRead")
        assert set(cur_stmt["Action"]) >= {
            "s3:GetObject",
            "s3:ListBucket",
        }


class TestOwnershipMetadata:
    """Tags + descriptions that distinguish CFN-managed resources from manual."""

    EXPECTED_TAGS = [
        {"Key": "ManagedBy", "Value": "Numio"},
        {"Key": "numio:managed-by", "Value": "CloudFormation"},
        {"Key": "numio:stack", "Value": {"Ref": "AWS::StackName"}},
        {"Key": "numio:instance-label", "Value": SAMPLE_LABEL},
    ]

    def test_user_has_four_ownership_tags(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        assert doc["Resources"]["NumioServiceUser"]["Properties"]["Tags"] == self.EXPECTED_TAGS

    def test_role_has_four_ownership_tags(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        assert doc["Resources"]["NumioCurReaderRole"]["Properties"]["Tags"] == self.EXPECTED_TAGS

    def test_instance_label_tag_carries_literal_label(self):
        body = render_template(_params(label="alpha"))
        doc = yaml.safe_load(body)
        for resource in ("NumioServiceUser", "NumioCurReaderRole"):
            tag_map = {
                t["Key"]: t["Value"] for t in doc["Resources"][resource]["Properties"]["Tags"]
            }
            assert tag_map["numio:instance-label"] == "alpha"
            assert tag_map["numio:stack"] == {"Ref": "AWS::StackName"}

    def test_role_description_contains_managed_by_sentence(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        desc = doc["Resources"]["NumioCurReaderRole"]["Properties"]["Description"]
        assert CFN_OWNERSHIP_NOTICE in desc

    def test_template_description_contains_managed_by_sentence(self):
        body = render_template(_params())
        doc = yaml.safe_load(body)
        assert CFN_OWNERSHIP_NOTICE in doc["Description"]

    def test_role_description_fits_iam_allowed_charset(self):
        """IAM enforces a strict pattern on Role.Properties.Description.

        AWS regex: ``[\\u0009\\u000A\\u000D\\u0020-\\u007E\\u00A1-\\u00FF]*``
        - tab, LF, CR, printable ASCII, printable Latin-1. Any character
        outside that set (e.g. the em-dash U+2014) makes CloudFormation fail
        the role's CREATE with "Member must satisfy regular expression
        pattern". Lock the rendered description to that charset so we never
        regress.
        """
        import re

        body = render_template(_params())
        doc = yaml.safe_load(body)
        desc = doc["Resources"]["NumioCurReaderRole"]["Properties"]["Description"]
        iam_pattern = re.compile("^[\u0009\u000a\u000d\u0020-\u007e\u00a1-\u00ff]*$")
        assert iam_pattern.match(desc), (
            f"Role description contains chars outside IAM's allowed pattern: {desc!r}"
        )

    def test_no_yaml_anchors_or_aliases(self):
        """CloudFormation rejects templates with YAML anchors / aliases.

        Anchors look like ``&id001`` after a key, aliases like ``*id001``
        in the position of a value. PyYAML emits them whenever the same
        Python object is referenced from two places — historically the
        shared tag list between the IAM user and role. The dumper must be
        configured to never emit them.
        """
        body = render_template(_params())
        # The most precise check: parse with strict pyyaml composer and look
        # at the event stream. Practically, a regex over the rendered string
        # is enough for CFN's actual rejection trigger.
        import re

        assert re.search(r"&id\d+", body) is None, "anchor leaked into rendered template"
        assert re.search(r"\*id\d+", body) is None, "alias leaked into rendered template"


class TestLabelValidation:
    @pytest.mark.parametrize(
        "label",
        [
            "a",
            "0",
            "wkt-aws-onboarding",
            "2604261950",
            "alice-2026-04-26",
            "a" * 32,
        ],
    )
    def test_valid_labels_accepted(self, label):
        assert validate_label(label) == label

    @pytest.mark.parametrize(
        "label",
        [
            "",
            None,
            "-leading-hyphen",
            "Has-Uppercase",
            "with_underscore",
            "with space",
            "with.dot",
            "a" * 33,  # too long
            "ümlaut",
        ],
    )
    def test_invalid_labels_rejected(self, label):
        with pytest.raises(LabelValidationError) as exc_info:
            validate_label(label)
        err = exc_info.value
        assert err.field == "label"
        assert err.pattern == LABEL_REGEX_STR
        assert err.example  # non-empty
        assert err.help  # explanatory help text present


class TestStackNameDefaults:
    def test_stack_name_uses_prefix_and_label(self):
        assert stack_name_for("foo") == f"{STACK_NAME_PREFIX}-foo"

    def test_user_name_uses_prefix_and_label(self):
        assert user_name_for("foo") == f"{USER_NAME_PREFIX}-foo"

    def test_role_name_uses_prefix_and_label(self):
        assert role_name_for("foo") == f"{ROLE_NAME_PREFIX}-foo"


# ---------------------------------------------------------------------------
# Launch URL construction
# ---------------------------------------------------------------------------


class TestTagWriterRole:
    """EnableTagWrites parameter gates the NumioTagWriterRole + output."""

    def test_parameter_present_default_false(self):
        doc = yaml.safe_load(render_template(_params()))
        param = doc["Parameters"]["EnableTagWrites"]
        assert param["Default"] == "false"
        assert param["AllowedValues"] == ["true", "false"]

    def test_parameter_default_true_when_enabled(self):
        doc = yaml.safe_load(render_template(_params(enable_tag_writes=True)))
        assert doc["Parameters"]["EnableTagWrites"]["Default"] == "true"

    def test_condition_defined(self):
        doc = yaml.safe_load(render_template(_params()))
        assert doc["Conditions"]["TagWritesEnabled"] == {
            "Fn::Equals": [{"Ref": "EnableTagWrites"}, "true"]
        }

    def test_role_rendered_and_gated_by_condition(self):
        # The role is always present in the template body but carries the
        # Condition so CFN only provisions it when EnableTagWrites=true.
        doc = yaml.safe_load(render_template(_params()))
        role = doc["Resources"]["NumioTagWriterRole"]
        assert role["Condition"] == "TagWritesEnabled"
        assert role["Type"] == "AWS::IAM::Role"
        assert role["Properties"]["MaxSessionDuration"] == 3600

    def test_role_name_includes_label(self):
        doc = yaml.safe_load(render_template(_params(label="abc123")))
        assert (
            doc["Resources"]["NumioTagWriterRole"]["Properties"]["RoleName"]
            == "NumioTagWriterRole-Cfn-abc123"
        )

    def test_role_trust_reuses_service_user_and_external_id(self):
        doc = yaml.safe_load(render_template(_params()))
        trust = doc["Resources"]["NumioTagWriterRole"]["Properties"][
            "AssumeRolePolicyDocument"
        ]
        stmt = trust["Statement"][0]
        assert stmt["Principal"] == {"AWS": {"Fn::GetAtt": ["NumioServiceUser", "Arn"]}}
        assert stmt["Condition"] == {
            "StringEquals": {"sts:ExternalId": {"Ref": "WorkspaceExternalId"}}
        }

    def test_policy_covers_spec_actions(self):
        doc = yaml.safe_load(render_template(_params()))
        policy = doc["Resources"]["NumioTagWriterRole"]["Properties"]["Policies"][0]
        assert policy["PolicyName"] == "NumioTagWriter"
        actions = {
            a for s in policy["PolicyDocument"]["Statement"] for a in s["Action"]
        }
        assert {
            "tag:TagResources",
            "tag:UntagResources",
            "ec2:CreateTags",
            "rds:AddTagsToResource",
            "s3:PutBucketTagging",
            "lambda:TagResource",
            "organizations:DescribeEffectivePolicy",
        } <= actions

    def test_output_conditional(self):
        doc = yaml.safe_load(render_template(_params()))
        out = doc["Outputs"]["TagWriterRoleArn"]
        assert out["Condition"] == "TagWritesEnabled"
        assert out["Value"] == {"Fn::GetAtt": ["NumioTagWriterRole", "Arn"]}


class TestBuildLaunchUrl:
    def test_default_region_upload_mode(self):
        params = _params()
        url = build_launch_url(region=DEFAULT_REGION, params=params, template_url=None)
        assert url.startswith(
            f"https://{DEFAULT_REGION}.console.aws.amazon.com/cloudformation/home"
        )
        assert "stacks/create/template" in url

    def test_custom_region_upload_mode(self):
        params = _params()
        url = build_launch_url(region="eu-west-1", params=params, template_url=None)
        assert url.startswith("https://eu-west-1.console.aws.amazon.com/cloudformation/home")

    def test_quickcreate_mode_includes_template_url_and_params(self):
        params = _params(
            cur_bucket_name="my-bucket",
            cur_report_name="my-report",
            cur_path_prefix="cur",
        )
        url = build_launch_url(
            region="us-east-1",
            stack_name="NumioConnect-wkt-aws-onboarding",
            template_url="https://example.com/t.yaml",
            params=params,
        )
        assert "quickcreate" in url
        # Parameters are in the URL fragment after #.
        fragment = urlparse(url).fragment
        _, _, query = fragment.partition("?")
        parsed = parse_qs(query)
        assert parsed["templateURL"] == ["https://example.com/t.yaml"]
        assert parsed["stackName"] == ["NumioConnect-wkt-aws-onboarding"]
        assert parsed["param_WorkspaceExternalId"] == [SAMPLE_EXTERNAL_ID]
        assert parsed["param_CurBucketName"] == ["my-bucket"]
        assert parsed["param_EnableTagWrites"] == ["false"]

    def test_quickcreate_includes_enable_tag_writes_true(self):
        url = build_launch_url(
            region="us-east-1",
            template_url="https://example.com/t.yaml",
            params=_params(enable_tag_writes=True),
        )
        parsed = parse_qs(urlparse(url).fragment.partition("?")[2])
        assert parsed["param_EnableTagWrites"] == ["true"]

    def test_default_stack_name_is_numio_connect_label(self):
        """When stack_name is omitted, default to NumioConnect-<label>."""
        params = _params(label="alpha-2026")
        url = build_launch_url(
            region="us-east-1",
            template_url="https://example.com/t.yaml",
            params=params,
        )
        fragment = urlparse(url).fragment
        _, _, query = fragment.partition("?")
        parsed = parse_qs(query)
        assert parsed["stackName"] == ["NumioConnect-alpha-2026"]


# ---------------------------------------------------------------------------
# HTTP endpoints (admin-only, workspace-scoped)
# ---------------------------------------------------------------------------


@pytest.fixture
async def api_client(db_session):
    """Return an httpx AsyncClient bound to the FastAPI app with the test DB."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_session, None)


class TestCfnTemplateEndpoint:
    async def test_get_returns_template_and_launch_url(self, api_client):
        resp = await api_client.get(
            "/api/v1/onboarding/cfn-template",
            params={"region": "us-east-1", "label": SAMPLE_LABEL},
        )
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["region"] == "us-east-1"
        assert payload["template_format"] == "yaml"
        assert payload["stack_name"] == f"NumioConnect-{SAMPLE_LABEL}"
        assert payload["label"] == SAMPLE_LABEL
        # Parse the YAML body.
        doc = yaml.safe_load(payload["template_body"])
        assert doc["Parameters"]["WorkspaceExternalId"]["Default"] == payload["external_id"]
        assert (
            doc["Resources"]["NumioServiceUser"]["Properties"]["UserName"]
            == f"NumioServiceUser-Cfn-{SAMPLE_LABEL}"
        )
        assert "cloudformation/home" in payload["launch_url"]
        assert payload["launch_mode"] in {"quickcreate", "upload"}
        assert payload["download_url"].startswith("/api/v1/onboarding/cfn-template/download")
        assert f"label={SAMPLE_LABEL}" in payload["download_url"]

    async def test_get_defaults_region_when_omitted(self, api_client):
        resp = await api_client.get(
            "/api/v1/onboarding/cfn-template", params={"label": SAMPLE_LABEL}
        )
        assert resp.status_code == 200
        assert resp.json()["region"] == DEFAULT_REGION

    async def test_get_falls_back_to_default_region_when_invalid(self, api_client):
        resp = await api_client.get(
            "/api/v1/onboarding/cfn-template",
            params={"region": "not-a-region", "label": SAMPLE_LABEL},
        )
        assert resp.status_code == 200
        assert resp.json()["region"] == DEFAULT_REGION

    async def test_get_rejects_missing_label_with_explanatory_body(self, api_client):
        resp = await api_client.get("/api/v1/onboarding/cfn-template")
        assert resp.status_code == 422
        body = resp.json()
        # Top-level message must explain regex, give an example, and explain
        # why the label is needed (multi-instance + admin identification).
        assert LABEL_REGEX_STR in body["message"]
        assert "wkt-aws-onboarding" in body["message"] or "example" in body["message"].lower()
        assert "multiple Numio instances" in body["message"]
        # Field-level breakdown points at the label.
        assert body["details"], "expected a details list"
        assert body["details"][0]["field"] == "label"

    @pytest.mark.parametrize(
        "bad_label", ["BadCase", "with_underscore", "-lead", "with space", "a" * 33]
    )
    async def test_get_rejects_invalid_label(self, api_client, bad_label):
        resp = await api_client.get("/api/v1/onboarding/cfn-template", params={"label": bad_label})
        assert resp.status_code == 422
        body = resp.json()
        assert LABEL_REGEX_STR in body["message"]
        assert body["details"][0]["field"] == "label"

    async def test_download_returns_yaml_attachment(self, api_client):
        resp = await api_client.get(
            "/api/v1/onboarding/cfn-template/download",
            params={"region": "us-east-1", "label": SAMPLE_LABEL},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/x-yaml")
        assert "attachment" in resp.headers["content-disposition"].lower()
        assert f"NumioConnect-{SAMPLE_LABEL}.yaml" in resp.headers["content-disposition"]
        # Body must parse as YAML and contain our role with the labeled name.
        doc = yaml.safe_load(resp.text)
        assert (
            doc["Resources"]["NumioCurReaderRole"]["Properties"]["RoleName"]
            == f"NumioCurReaderRole-Cfn-{SAMPLE_LABEL}"
        )

    async def test_download_rejects_missing_label(self, api_client):
        resp = await api_client.get("/api/v1/onboarding/cfn-template/download")
        assert resp.status_code == 422

    async def test_features_reports_chat_flag(self, api_client):
        resp = await api_client.get("/api/v1/onboarding/features")
        assert resp.status_code == 200
        body = resp.json()
        assert "chat_enabled" in body
        assert isinstance(body["chat_enabled"], bool)

    async def test_get_forwards_cur_prefills_into_template(self, api_client):
        resp = await api_client.get(
            "/api/v1/onboarding/cfn-template",
            params={
                "label": SAMPLE_LABEL,
                "cur_bucket_name": "my-bucket",
                "cur_report_name": "my-report",
                "cur_path_prefix": "cur/daily",
            },
        )
        assert resp.status_code == 200
        doc = yaml.safe_load(resp.json()["template_body"])
        assert doc["Parameters"]["CurBucketName"]["Default"] == "my-bucket"
        assert doc["Parameters"]["CurReportName"]["Default"] == "my-report"
        assert doc["Parameters"]["CurPathPrefix"]["Default"] == "cur/daily"

    async def test_two_distinct_labels_render_distinct_names(self, api_client):
        """AC #10: two labels in same account produce non-colliding names."""
        r1 = await api_client.get("/api/v1/onboarding/cfn-template", params={"label": "alpha"})
        r2 = await api_client.get("/api/v1/onboarding/cfn-template", params={"label": "beta"})
        d1 = yaml.safe_load(r1.json()["template_body"])
        d2 = yaml.safe_load(r2.json()["template_body"])
        assert (
            d1["Resources"]["NumioServiceUser"]["Properties"]["UserName"]
            != d2["Resources"]["NumioServiceUser"]["Properties"]["UserName"]
        )
        assert (
            d1["Resources"]["NumioCurReaderRole"]["Properties"]["RoleName"]
            != d2["Resources"]["NumioCurReaderRole"]["Properties"]["RoleName"]
        )
        assert r1.json()["stack_name"] != r2.json()["stack_name"]
