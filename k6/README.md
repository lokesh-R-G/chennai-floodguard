# k6 Load Testing

## Install k6

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker pull grafana/k6
```

## Run Tests

```bash
# Smoke test only (5 VUs, 30s)
k6 run --env BASE_URL=http://localhost:5000 k6/load-test.js

# With specific scenario
k6 run --env BASE_URL=http://localhost:5000 --tag scenario=smoke k6/load-test.js

# Export results to JSON
k6 run --out json=k6/results.json k6/load-test.js
```

## Thresholds

| Metric            | Target          |
|--------------------|-----------------|
| p95 latency        | < 500ms         |
| p99 latency        | < 1500ms        |
| Error rate         | < 5%            |
| Auth latency p95   | < 800ms         |
| Incident latency   | < 1000ms        |
| Health latency     | < 200ms         |
