FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY start.sh .
RUN chmod +x start.sh

# Expose port
EXPOSE 8000

# Run the start script to launch both Celery and FastAPI
CMD ["./start.sh"]
