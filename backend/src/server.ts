const app = require('./app');
const prisma = require('./prisma/client');
const { startSlaEvaluationWorker, stopSlaEvaluationWorker } = require('./workers/slaWorker');

const PORT = process.env.PORT || 4000;

const validateProductionConfiguration = (): void => {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (!process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required in production');
  }
};

const start = async (): Promise<void> => {
  try {
    validateProductionConfiguration();
    await prisma.$connect();
    console.log('✓ تم الاتصال بقاعدة البيانات بنجاح');
    if (process.env.NODE_ENV !== 'test') {
      startSlaEvaluationWorker();
      console.log('✓ تم تشغيل خدمة تقييم مهلة المعالجة الآلية في الخلفية');
    }
    const server = app.listen(PORT, () => console.log(`✓ خادم CFMS يعمل على المنفذ ${PORT}`));
    const shutdown = (signal: string) => {
      console.log(`إيقاف الخادم بسبب ${signal}`);
      stopSlaEvaluationWorker();
      server.close(() => {
        void prisma.$disconnect().finally(() => process.exit(0));
      });
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('✗ فشل الاتصال بقاعدة البيانات:', (err as Error).message);
    process.exit(1);
  }
};

start();
