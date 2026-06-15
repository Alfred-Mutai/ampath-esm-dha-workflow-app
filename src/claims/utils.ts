export const getUrl = () => {
    const baseUrl = "https://ilm-dev.dha.go.ke/uat-middleware";
    const version = "/api/v1"
    return `${baseUrl}${version}`;
}

export async function fetchUrl<T>(url: string, { method = "GET", headers, payload, isFormData = false }: { method?: string, headers?: Record<string, any>, payload?: unknown, isFormData?: boolean } = {}): Promise<T> {
    // Temporarily
    const authToken = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJRRzhsY1ZKeG5jS0pCY1hveWVNbmRZWWRaNHdSV2lXY1lBWVppLWlCalBNIn0.eyJleHAiOjE3ODA1Njk5ODMsImlhdCI6MTc4MDU2NjM4MywianRpIjoidHJydGNjOjQ4MmIzNmQ5LTA5MTgtOTI4Ni1kMGIzLTAzYjBhYzE5MWY1OCIsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMtdWF0LmRoYS5nby5rZS9yZWFsbXMvaGllIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjQ1YTIyYjIzLTUxZTEtNDIwNi05NzcyLTdlYWM0MzA2NjM3MyIsInR5cCI6IkJlYXJlciIsImF6cCI6ImFtcnMiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbIi8qIl0sInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJkZWZhdWx0LXJvbGVzLWhpZSJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJ2aWV3LWFwcGxpY2F0aW9ucyIsInZpZXctY29uc2VudCIsInZpZXctZ3JvdXBzIiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJkZWxldGUtYWNjb3VudCIsIm1hbmFnZS1jb25zZW50Iiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJlbWFpbCB0ZW5hbnQgcHJvZmlsZSBwaG9uZSIsInRlbmFudF9pZCI6ImFtcnMiLCJ0ZW5hbnRfbmFtZSI6ImFtcnMiLCJjbGllbnRIb3N0IjoiMTAuMC4zLjQ4IiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmYWNpbGl0eV9pZF90eXBlIjoiZnItY29kZSIsImZhY2lsaXR5X2lkIjoiRklELTI3LTExNjAwNy03IiwidGVuYW50X3R5cGUiOiJvcmdhbmlzYXRpb24iLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJzZXJ2aWNlLWFjY291bnQtYW1ycyIsImNsaWVudEFkZHJlc3MiOiIxMC4wLjMuNDgiLCJjbGllbnRfaWQiOiJhbXJzIn0.JXb07V9Qdx0yvnbT6_8bAhqXbDHRtK8XaW2C6Hm04mAZbuTkjB5By9rIrAbeSX6hbiMfZOwrNdWT9Jz473QX6kTde6GxAkjguFNpQ51UrM1g5NUb9IAqSqQsHlYuSSpmK254jMNYocJNEzry9W1gzjs0Q5TPkppF6xASHtyDq6gb1TpYeYzKEwvzvO9nq0VA6ZHRLQ87ZDEvqmxPcOVvHIhZaiNLMZ_UviDmaz2zMuXuioCJftQMMIxzpLP4XFzlkPt7jVdLqhsymAr6NxpNS9KI2irTiMqpS9jRnqU07h1Fsl38ss37boQJAo0rosLrmJBWcYMG0WSNcU9wZFEpRw";
    // const myHeaders = new Headers();
    // myHeaders.append("Content-Type", "multipart/form-data");

    headers = {
        ...headers,
        Authorization: `Bearer ${authToken}`,
        'X-Facility-Id': 'FID-27-114387-5',
        'X-Facility-Id-Type': 'fr-code'
    }

    if (isFormData) {
        headers["Content-Type"] = "multipart/form-data";
        headers["Accept"] = "application/json";
    } else {
        headers["Content-Type"] = "application/json";
    }

    let request = {
        method: method,
        headers: { ...headers },
        ...{ method },
    }

    if (method === "POST" && payload) {
        request["body"] = isFormData ? payload : JSON.stringify(payload)
    }

    const response = await fetch(url, request);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Request failed with ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
}