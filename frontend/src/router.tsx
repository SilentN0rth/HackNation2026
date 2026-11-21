import { createBrowserRouter } from "react-router";
import { Layout } from "@/components/Layout";
import { MyApplicationsView } from "@/features/citizen/MyApplicationsView";
import { ServicesView } from "@/features/citizen/ServicesView";
import { AuditView } from "@/features/official/AuditView";
import { DashboardView } from "@/features/official/DashboardView";
import { UploadView } from "@/features/official/UploadView";
import { HomeView } from "@/features/HomeView";
import { NotFoundView } from "@/features/NotFoundView";
import { EditorRoute, FillFormRoute } from "@/features/routeParams";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomeView />, handle: { title: "Start" } },
      { path: "official", element: <DashboardView />, handle: { title: "Formularze" } },
      { path: "official/upload", element: <UploadView />, handle: { title: "Nowy formularz" } },
      { path: "official/drafts/:id", element: <EditorRoute />, handle: { title: "Edytor formularza" } },
      { path: "official/audit", element: <AuditView />, handle: { title: "Dziennik decyzji" } },
      { path: "citizen", element: <ServicesView />, handle: { title: "Usługi" } },
      { path: "citizen/applications", element: <MyApplicationsView />, handle: { title: "Twoje sprawy" } },
      { path: "citizen/form/:id", element: <FillFormRoute />, handle: { title: "Wniosek" } },
      { path: "*", element: <NotFoundView />, handle: { title: "Nie znaleziono" } },
    ],
  },
]);
