#!/bin/bash
set -e

# Variables
AWS_ACCOUNT_ID="970698326368"
AWS_REGION="us-east-1"
ECR_REPOSITORY="test-de-nivel"
SERVICE_NAME="test-de-nivel"
IMAGE_TAG="latest"

echo "🔐 Autenticando Docker con ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "🏗️  Construyendo imagen Docker..."
docker build -t $ECR_REPOSITORY:$IMAGE_TAG .

echo "🏷️  Etiquetando imagen..."
docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "📤 Subiendo imagen a ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "✅ Imagen subida exitosamente!"
echo "URI de la imagen: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"

echo ""
echo "🚀 Ahora ejecuta el siguiente comando para crear el servicio App Runner:"
echo ""
echo "aws apprunner create-service \\"
echo "  --service-name $SERVICE_NAME \\"
echo "  --source-configuration '{\"ImageRepository\":{\"ImageIdentifier\":\"$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG\",\"ImageConfiguration\":{\"Port\":\"8000\"},\"ImageRepositoryType\":\"ECR\"}}' \\"
echo "  --instance-configuration '{\"Cpu\":\"1 vCPU\",\"Memory\":\"2 GB\"}' \\"
echo "  --region $AWS_REGION"
