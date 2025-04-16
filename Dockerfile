FROM python:3.9-slim

WORKDIR /app

# Instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar arquivos do projeto
COPY . .

# Expor a porta que a aplicação vai usar
EXPOSE 5000

# Variáveis de ambiente (podem ser substituídas durante o deploy)
ENV SECRET_KEY=bee-tv-secret-key
ENV PORT=5000
ENV HOST=0.0.0.0
ENV DEBUG=False

# Comando para iniciar a aplicação com Gunicorn e eventlet
CMD gunicorn --config gunicorn_config.py app:app