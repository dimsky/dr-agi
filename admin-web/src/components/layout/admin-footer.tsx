export function AdminFooter() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            {/* Left side - Copyright */}
            <div className="text-sm text-muted-foreground">
              © 2025 DR.Agent AI 医学服务平台. 保留所有权利.
            </div>
            
            {/* Center - System info */}
            {/* <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Next.js 15</span>
              <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
              <span>TanStack Query v5</span>
              <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
              <span>Drizzle ORM</span>
            </div> */}
            
            {/* Right side - Version */}
            <div className="text-sm text-muted-foreground">
              版本 v1.0.0
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}