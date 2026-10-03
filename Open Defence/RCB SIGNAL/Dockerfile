FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY web ./web
COPY data ./data
ENV HOST=0.0.0.0 PORT=8080 SIGNAL_PROVIDER=mock
EXPOSE 8080
CMD ["python3", "server.py"]
