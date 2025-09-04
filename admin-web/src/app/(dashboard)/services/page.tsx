import { AddServiceButton } from '@/components/client/add-service-button';
import { ServiceList } from '@/components/client/service-list';

// 服务配置列表组件（现在只显示操作按钮和客户端列表）
function ServiceConfigList() {
  return (
    <div className="space-y-6">
      {/* 服务配置操作区 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">服务配置列表</h2>
        <AddServiceButton>
          添加新服务
        </AddServiceButton>
      </div>

      {/* 客户端服务列表组件 */}
      <ServiceList />
    </div>
  );
}

// 主服务配置页面（Server Component）
export default async function ServicesPage() {
  return (
    <div className="admin-container admin-page">
      <div className="space-y-6">
        {/* 页面头部 */}
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold">医疗服务配置</h1>
          <p className="text-sm text-muted-foreground mt-2">
            管理AI医疗服务的Dify工作流配置、定价策略和输入验证规则
          </p>
        </div>

        {/* 服务配置内容 */}
        <ServiceConfigList />
      </div>
    </div>
  );
}

// 导出页面元数据
export const metadata = {
  title: '服务配置 - DR.Agent医疗平台',
  description: '管理AI医疗服务的配置信息，包括Dify工作流配置、定价策略等',
};