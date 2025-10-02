# Setup de GitHub Actions para AWS App Runner

## Paso 1: Configurar secretos en GitHub

Ve a tu repositorio en GitHub: `https://github.com/jose-sanchez-preisig/interview_simulator`

Luego navega a: **Settings → Secrets and variables → Actions → New repository secret**

Agrega los siguientes secretos:

### 1. AWS_ACCESS_KEY_ID
- Valor: Tu AWS Access Key ID (actualmente usando usuario Diego)

### 2. AWS_SECRET_ACCESS_KEY
- Valor: Tu AWS Secret Access Key

### 3. OPENAI_API_KEY
- Valor: Tu OpenAI API Key

## Paso 2: Verificar permisos del repositorio

1. Ve a **Settings → Actions → General**
2. En **Workflow permissions**, asegúrate de que esté seleccionado:
   - ✅ "Read and write permissions"

## Paso 3: Hacer push de los cambios

Una vez configurados los secretos, ejecuta:

```bash
git add .
git commit -m "Add GitHub Actions workflow for AWS App Runner deployment"
git push origin main
```

## Paso 4: Ejecutar el workflow

El workflow se ejecutará automáticamente con el push a `main`, pero también puedes ejecutarlo manualmente:

1. Ve a **Actions** en tu repositorio
2. Selecciona el workflow "Deploy to AWS App Runner"
3. Haz clic en "Run workflow"
4. Selecciona la rama `main`
5. Haz clic en "Run workflow"

## Paso 5: Verificar el despliegue

1. Observa el progreso en la pestaña **Actions**
2. Una vez completado, verás la URL del servicio en los logs
3. El servicio estará disponible en: `https://[random-id].awsapprunner.com`

## Recursos creados

- ✅ Repositorio ECR: `test-de-nivel`
- ✅ Rol IAM: `AppRunnerECRAccessRole`
- 🔄 Servicio App Runner: `test-de-nivel` (se creará con el primer deploy)

## Despliegues futuros

Cada push a la rama `main` activará automáticamente un nuevo despliegue.

## Comandos útiles (opcional)

### Ver estado del servicio:
```bash
aws apprunner list-services --region us-east-1
```

### Obtener URL del servicio:
```bash
SERVICE_ARN=$(aws apprunner list-services --region us-east-1 --query "ServiceSummaryList[?ServiceName=='test-de-nivel'].ServiceArn" --output text)
aws apprunner describe-service --service-arn $SERVICE_ARN --region us-east-1 --query 'Service.ServiceUrl' --output text
```

### Ver logs del servicio:
```bash
SERVICE_ARN=$(aws apprunner list-services --region us-east-1 --query "ServiceSummaryList[?ServiceName=='test-de-nivel'].ServiceArn" --output text)
aws apprunner describe-service --service-arn $SERVICE_ARN --region us-east-1
```

## Troubleshooting

Si el workflow falla:

1. Verifica que los secretos estén configurados correctamente
2. Revisa los logs en la pestaña Actions
3. Verifica que el rol IAM tenga los permisos correctos
4. Asegúrate de que el repositorio ECR exista

## Consideraciones importantes

- El servicio usa 1 vCPU y 2 GB de memoria
- El timeout de Gunicorn está configurado en 120 segundos
- El auto-deployment está habilitado (detecta nuevas imágenes en ECR)
- La variable `OPENAI_API_KEY` debe estar configurada en los secretos de GitHub
