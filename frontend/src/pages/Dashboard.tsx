import KpiCards from '../components/dashboard/KpiCards'
import EngagementChart from '../components/dashboard/EngagementChart'
import SentimentDonut from '../components/dashboard/SentimentDonut'
import TopPostsTable from '../components/dashboard/TopPostsTable'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <KpiCards />

      <div dir="ltr" className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <EngagementChart />
        </div>
        <div className="lg:col-span-2">
          <SentimentDonut />
        </div>
      </div>

      <TopPostsTable />
    </div>
  )
}
