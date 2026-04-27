# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python import
import os
import re
from typing import List, Dict, Tuple

import boto3
from botocore.config import Config as BotocoreConfig

_PHOTO_FILENAME_RE = re.compile(r"^[VEJGP]-\d{6,10}-[a-f0-9]+\.jpg$", re.IGNORECASE)

# Third party import
from openai import OpenAI
import requests

from django.http import HttpResponse
from rest_framework import status
from rest_framework.response import Response

# Module import
from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers import ProjectLiteSerializer, WorkspaceLiteSerializer
from plane.db.models import Project, Workspace
from plane.license.utils.instance_value import get_configuration_value
from plane.utils.exception_logger import log_exception

from ..base import BaseAPIView


class LLMProvider:
    """Base class for LLM provider configurations"""

    name: str = ""
    models: List[str] = []
    default_model: str = ""

    @classmethod
    def get_config(cls) -> Dict[str, str | List[str]]:
        return {
            "name": cls.name,
            "models": cls.models,
            "default_model": cls.default_model,
        }


class OpenAIProvider(LLMProvider):
    name = "OpenAI"
    models = ["gpt-3.5-turbo", "gpt-4o-mini", "gpt-4o", "o1-mini", "o1-preview"]
    default_model = "gpt-4o-mini"


class AnthropicProvider(LLMProvider):
    name = "Anthropic"
    models = [
        "claude-3-5-sonnet-20240620",
        "claude-3-haiku-20240307",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-2.1",
        "claude-2",
        "claude-instant-1.2",
        "claude-instant-1",
    ]
    default_model = "claude-3-sonnet-20240229"


class GeminiProvider(LLMProvider):
    name = "Gemini"
    models = ["gemini-pro", "gemini-1.5-pro-latest", "gemini-pro-vision"]
    default_model = "gemini-pro"


SUPPORTED_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "gemini": GeminiProvider,
}


def get_llm_config() -> Tuple[str | None, str | None, str | None]:
    """
    Helper to get LLM configuration values, returns:
        - api_key, model, provider
    """
    api_key, provider_key, model = get_configuration_value(
        [
            {
                "key": "LLM_API_KEY",
                "default": os.environ.get("LLM_API_KEY", None),
            },
            {
                "key": "LLM_PROVIDER",
                "default": os.environ.get("LLM_PROVIDER", "openai"),
            },
            {
                "key": "LLM_MODEL",
                "default": os.environ.get("LLM_MODEL", None),
            },
        ]
    )

    provider = SUPPORTED_PROVIDERS.get(provider_key.lower())
    if not provider:
        log_exception(ValueError(f"Unsupported provider: {provider_key}"))
        return None, None, None

    if not api_key:
        log_exception(ValueError(f"Missing API key for provider: {provider.name}"))
        return None, None, None

    # If no model specified, use provider's default
    if not model:
        model = provider.default_model

    # Validate model is supported by provider
    if model not in provider.models:
        log_exception(
            ValueError(
                f"Model {model} not supported by {provider.name}. Supported models: {', '.join(provider.models)}"
            )
        )
        return None, None, None

    return api_key, model, provider_key


def get_llm_response(task, prompt, api_key: str, model: str, provider: str) -> Tuple[str | None, str | None]:
    """Helper to get LLM completion response"""
    final_text = task + "\n" + prompt
    try:
        # For Gemini, prepend provider name to model
        if provider.lower() == "gemini":
            model = f"gemini/{model}"

        client = OpenAI(api_key=api_key)
        chat_completion = client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": final_text}]
        )
        text = chat_completion.choices[0].message.content
        return text, None
    except Exception as e:
        log_exception(e)
        error_type = e.__class__.__name__
        if error_type == "AuthenticationError":
            return None, f"Invalid API key for {provider}"
        elif error_type == "RateLimitError":
            return None, f"Rate limit exceeded for {provider}"
        else:
            return None, f"Error occurred while generating response from {provider}"


class GPTIntegrationEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        api_key, model, provider = get_llm_config()

        if not api_key or not model or not provider:
            return Response(
                {"error": "LLM provider API key and model are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        text, error = get_llm_response(task, request.data.get("prompt", False), api_key, model, provider)
        if not text and error:
            return Response(
                {"error": "An internal error has occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        workspace = Workspace.objects.get(slug=slug)
        project = Project.objects.get(pk=project_id)

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
                "project_detail": ProjectLiteSerializer(project).data,
                "workspace_detail": WorkspaceLiteSerializer(workspace).data,
            },
            status=status.HTTP_200_OK,
        )


class WorkspaceGPTIntegrationEndpoint(BaseAPIView):
    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        api_key, model, provider = get_llm_config()

        if not api_key or not model or not provider:
            return Response(
                {"error": "LLM provider API key and model are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        task = request.data.get("task", False)
        if not task:
            return Response({"error": "Task is required"}, status=status.HTTP_400_BAD_REQUEST)

        text, error = get_llm_response(task, request.data.get("prompt", False), api_key, model, provider)
        if not text and error:
            return Response(
                {"error": "An internal error has occurred."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "response": text,
                "response_html": text.replace("\n", "<br/>"),
            },
            status=status.HTTP_200_OK,
        )


def _onfalo_headers() -> dict:
    return {
        "X-Api-Key": os.environ.get("ONFALO_API_KEY", ""),
        "X-Tenant-Id": os.environ.get("ONFALO_TENANT_ID", "sp3"),
    }


def _onfalo_url() -> str:
    return os.environ.get("ONFALO_API_URL", "https://api.onfalo.nexus.ia.ve")


class CedulaLookupView(BaseAPIView):
    """Proxy hacia Onfalo API para buscar datos personales por cédula venezolana."""

    def get(self, request, prefix, cedula):
        if not os.environ.get("ONFALO_API_KEY"):
            return Response({"error": "ONFALO_API_KEY no configurado"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        cedula_num = "".join(c for c in cedula if c.isdigit())
        nationality = prefix.upper() if prefix.upper() in ("V", "E", "J", "G", "P") else "V"
        if not cedula_num:
            return Response({"error": "Cédula inválida"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resp = requests.post(
                f"{_onfalo_url()}/v1/person/search/external/full/{nationality}/{cedula_num}",
                json={},
                headers={**_onfalo_headers(), "Content-Type": "application/json"},
                timeout=10,
                verify=False,
            )
            try:
                data = resp.json()
            except Exception:
                data = {"raw": resp.text}
            return Response(data, status=resp.status_code)
        except Exception as e:
            log_exception(e)
            return Response({"error": "Error al consultar Onfalo"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


def _minio_client():
    """Retorna un cliente boto3 apuntando al MinIO de Onfalo."""
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("ONFALO_MINIO_URL", "http://10.51.12.85:9000"),
        aws_access_key_id=os.environ.get("ONFALO_MINIO_USER", "GHP_GCS"),
        aws_secret_access_key=os.environ.get(
            "ONFALO_MINIO_TOKEN",
            "3aee7c976753c5050c7e1a120cf17177380a58a591aee40618f4d4c6de114e96",
        ),
        config=BotocoreConfig(signature_version="s3v4"),
        region_name="us-east-1",
    )


class CedulaPhotoView(BaseAPIView):
    """Proxy de fotos de cédula — descarga desde MinIO con credenciales internas."""

    def get(self, request, filename):
        if not _PHOTO_FILENAME_RE.match(filename):
            return Response({"error": "Nombre de archivo inválido"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            bucket = os.environ.get("ONFALO_MINIO_BUCKET", "alfa-images")
            s3 = _minio_client()
            obj = s3.get_object(Bucket=bucket, Key=filename)
            content_type = obj.get("ContentType", "image/jpeg")
            return HttpResponse(obj["Body"].read(), content_type=content_type, status=200)
        except Exception as e:
            log_exception(e)
            return Response({"error": "Error al obtener foto"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class UnsplashEndpoint(BaseAPIView):
    def get(self, request):
        (UNSPLASH_ACCESS_KEY,) = get_configuration_value(
            [
                {
                    "key": "UNSPLASH_ACCESS_KEY",
                    "default": os.environ.get("UNSPLASH_ACCESS_KEY"),
                }
            ]
        )
        # Check unsplash access key
        if not UNSPLASH_ACCESS_KEY:
            return Response([], status=status.HTTP_200_OK)

        # Query parameters
        query = request.GET.get("query", False)
        page = request.GET.get("page", 1)
        per_page = request.GET.get("per_page", 20)

        url = (
            f"https://api.unsplash.com/search/photos/?client_id={UNSPLASH_ACCESS_KEY}&query={query}&page=${page}&per_page={per_page}"
            if query
            else f"https://api.unsplash.com/photos/?client_id={UNSPLASH_ACCESS_KEY}&page={page}&per_page={per_page}"
        )

        headers = {"Content-Type": "application/json"}

        resp = requests.get(url=url, headers=headers)
        return Response(resp.json(), status=resp.status_code)
