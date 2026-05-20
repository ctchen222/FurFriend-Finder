{{- define "observability-stack.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "observability-stack.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "observability-stack.labels" -}}
helm.sh/chart: {{ include "observability-stack.chart" . }}
app.kubernetes.io/name: {{ include "observability-stack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "observability-stack.selectorLabels" -}}
app.kubernetes.io/name: {{ include "observability-stack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "observability-stack.storageClassName" -}}
{{- $componentClass := .componentStorage.storageClassName | default "" -}}
{{- default .root.Values.global.storageClassName $componentClass -}}
{{- end -}}

{{- define "observability-stack.otelCollector.name" -}}
{{- .Values.serviceNames.otelCollector | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "observability-stack.prometheus.name" -}}
{{- .Values.serviceNames.prometheus | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "observability-stack.tempo.name" -}}
{{- .Values.serviceNames.tempo | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "observability-stack.loki.name" -}}
{{- .Values.serviceNames.loki | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "observability-stack.grafana.name" -}}
{{- .Values.serviceNames.grafana | trunc 63 | trimSuffix "-" -}}
{{- end -}}
