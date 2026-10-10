# RouteRakshak AI

A responsive React/Vite prototype for campus journey planning and shared transport operations. Students can search routes, make local demo bookings, and submit rescue requests; drivers can manage journey status and submit linked incidents; admins can manage the sample fleet and routes and assign replacement vehicles.

## Run locally

```bash
npm install
npm run dev
```

To create a production bundle:

```bash
npm run build
```

## Demo access

Open `/login` and choose **Student**, **Driver**, or **Admin**. No password is required, requested, or stored. Sample accounts are selected locally:

- Student: Aanya Sharma
- Driver: Arjun Rao
- Admin: Kavya Menon

Role selection is a client-side prototype convenience only. It is not production authentication or authorization.

## Shared prototype workflow

Data is stored in browser `localStorage` under a versioned demo key. Booking, cancellation, notifications, driver incidents, rescue requests, fleet edits, route assignment, and replacement assignment persist through reloads in the same browser. Sign out and select another role to see the shared records. The Settings page can reset local demo data.

## Limitations

- Seeded schedules, seat availability, demand/occupancy values, and sample booking references are labelled demo data.
- The tracking page is a route schematic; there is no live GPS or real vehicle coordinate.
- Replacement assignment only updates local prototype records. There is no real transport dispatch.
- No SMS, email, emergency-services contact, payment, external map, secure production authentication, or actual AI prediction is connected.
- Safety screens give guidance but do not send a check-in or contact anyone outside the browser.
