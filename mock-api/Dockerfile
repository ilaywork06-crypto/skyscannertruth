FROM python:3.12-alpine
WORKDIR /app
COPY mock_api.py ./mock_api.py
ENV MOCK_API_HOST=0.0.0.0 MOCK_API_PORT=8000
EXPOSE 8000
CMD ["python3", "-u", "mock_api.py"]
