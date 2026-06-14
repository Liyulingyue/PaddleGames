import { Header, Layout } from '../../components'

export default function RLBattle() {
  return (
    <Layout>
      <Header title="🤖 RL Battle" showBack />
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-4">RL Battle</h2>
          <p className="text-slate-400">游戏开发中，敬请期待...</p>
        </div>
      </div>
    </Layout>
  )
}
