# Despliegue en AWS App Runner

## Prerrequisitos
- Docker instalado
- AWS CLI configurado con credenciales activas
- Variable de entorno `OPENAI_API_KEY`

## Pasos para desplegar

### Opción 1: Usando el script de despliegue (recomendado)

```bash
./deploy.sh
```

Este script:
1. Autentica Docker con ECR
2. Construye la imagen Docker
3. Sube la imagen a ECR
4. Muestra el comando para crear el servicio en App Runner

### Opción 2: Comandos manuales

1. **Autenticar Docker con ECR:**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 970698326368.dkr.ecr.us-east-1.amazonaws.com
```

2. **Construir la imagen:**
```bash
docker build -t test-de-nivel:latest .
```

3. **Etiquetar la imagen:**
```bash
docker tag test-de-nivel:latest 970698326368.dkr.ecr.us-east-1.amazonaws.com/test-de-nivel:latest
```

4. **Subir a ECR:**
```bash
docker push 970698326368.dkr.ecr.us-east-1.amazonaws.com/test-de-nivel:latest
```

5. **Crear rol de acceso para App Runner:**
```bash
aws iam create-role \
  --role-name AppRunnerECRAccessRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "build.apprunner.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name AppRunnerECRAccessRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
```

6. **Crear el servicio en App Runner:**
```bash
aws apprunner create-service \
  --service-name test-de-nivel \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "970698326368.dkr.ecr.us-east-1.amazonaws.com/test-de-nivel:latest",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {
          "OPENAI_API_KEY": "tu-api-key-aqui"
        }
      },
      "ImageRepositoryType": "ECR"
    },
    "AutoDeploymentsEnabled": false,
    "AuthenticationConfiguration": {
      "AccessRoleArn": "arn:aws:iam::970698326368:role/AppRunnerECRAccessRole"
    }
  }' \
  --instance-configuration '{
    "Cpu": "1 vCPU",
    "Memory": "2 GB"
  }' \
  --region us-east-1
```

7. **Verificar el estado del servicio:**
```bash
aws apprunner list-services --region us-east-1
```

8. **Obtener la URL del servicio:**
```bash
aws apprunner describe-service \
  --service-arn <ARN-del-servicio> \
  --region us-east-1 \
  --query 'Service.ServiceUrl' \
  --output text
```

## Configuración de variables de entorno

Para agregar o actualizar la variable `OPENAI_API_KEY`:

```bash
aws apprunner update-service \
  --service-arn <ARN-del-servicio> \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "970698326368.dkr.ecr.us-east-1.amazonaws.com/test-de-nivel:latest",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {
          "OPENAI_API_KEY": "tu-api-key-real"
        }
      },
      "ImageRepositoryType": "ECR"
    }
  }' \
  --region us-east-1
```

## Actualizar el servicio

Para actualizar el servicio con una nueva imagen:

1. Reconstruir y subir la imagen siguiendo los pasos 2-4
2. App Runner detectará automáticamente la nueva imagen si `AutoDeploymentsEnabled` está en true
3. O forzar un nuevo despliegue manualmente

## Notas importantes

- El repositorio ECR ya está creado: `test-de-nivel`
- El servicio escucha en el puerto 8000
- Usa Gunicorn con 2 workers y timeout de 120s
- Incluye ffmpeg para conversión de audio
- Requiere la variable de entorno `OPENAI_API_KEY`
