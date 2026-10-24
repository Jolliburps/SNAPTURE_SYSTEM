import { Link } from 'react-router'
import { PageHeading } from '../components/ui'

export default function NotFoundPage() {
  return <><PageHeading title="Page not found" description="The requested page does not exist." /><Link className="primary-button" to="/dashboard">Back to Dashboard</Link></>
}
