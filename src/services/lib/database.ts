import { Sequelize } from 'sequelize';

// 统一使用MySQL数据库配置
const {
  MYSQL_HOST = '43.156.33.21',
  MYSQL_PORT = '3306',
  MYSQL_DATABASE = 'stock',
  MYSQL_USER = 'root',
  MYSQL_PASSWORD = 'Asd123456!',
} = process.env;
const sequelize = new Sequelize(
  MYSQL_DATABASE,
  MYSQL_USER,
  MYSQL_PASSWORD,
  {
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    dialect: 'mysql',
    logging: false,//process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true, // 自动添加createdAt和updatedAt
      underscored: true, // 使用下划线命名
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

// 测试数据库连接
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
};

// 同步数据库表结构
export const syncDatabase = async (force = false): Promise<void> => {
  try {
    await sequelize.sync({ force });
    console.log('✅ 数据库表同步成功');
  } catch (error) {
    console.error('❌ 数据库表同步失败:', error);
    throw error;
  }
};

export default sequelize;