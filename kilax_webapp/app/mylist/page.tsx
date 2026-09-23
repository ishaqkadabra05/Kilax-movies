import { redirect } from 'next/navigation'

export default function MyListRoute() {
  redirect('/?page=mylist')
}
