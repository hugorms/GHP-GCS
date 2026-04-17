# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# rebuild

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import F, Func, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    CycleIssue,
    FileAsset,
    Issue,
    IssueAssignee,
    IssueLink,
)
from plane.utils.timezone_converter import user_timezone_converter

from .. import BaseAPIView


class SocialCaseReportEndpoint(BaseAPIView):
    """
    Devuelve todos los issues de un proyecto que contienen una ficha
    de caso social (data-social-case="1" en description_html), incluyendo
    el campo description_html completo para que el frontend pueda parsearlos.
    """

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        # Soporta múltiples estados: ?estados=Carabobo,Miranda,Lara
        estados_raw = request.query_params.get("estados", "").strip()
        estados = [e.strip() for e in estados_raw.split(",") if e.strip()] if estados_raw else []

        base_filters = {
            "workspace__slug": slug,
            "project_id": project_id,
            "description_html__contains": 'data-social-case="1"',
        }

        queryset = Issue.issue_objects.filter(**base_filters)

        if estados:
            # OR entre todos los estados seleccionados
            estado_q = Q()
            for e in estados:
                estado_q |= Q(description_html__icontains=f'>{e}<')
            queryset = queryset.filter(estado_q)

        queryset = (
            queryset
            .annotate(
                # assignee_ids no es columna directa — es una relación M2M
                assignee_ids=Coalesce(
                    ArrayAgg(
                        "issue_assignee__assignee_id",
                        filter=Q(issue_assignee__assignee_id__isnull=False),
                        distinct=True,
                    ),
                    [],
                )
            )
            .order_by("-created_at")
            .values(
                "id",
                "sequence_id",
                "name",
                "description_html",
                "state_id",
                "priority",
                "assignee_ids",
                "project_id",
                "created_at",
                "updated_at",
                "start_date",
                "is_draft",
                "archived_at",
            )
        )

        datetime_fields = ["created_at", "updated_at"]
        issues = user_timezone_converter(
            queryset, datetime_fields, request.user.user_timezone
        )

        return Response(list(issues), status=status.HTTP_200_OK)
