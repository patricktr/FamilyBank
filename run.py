"""Entry point for Family Bank application."""

import os
import threading
import time
from app.main import create_app
from app.jobs import run_all_jobs

app = create_app()


def scheduler():
    """Background scheduler that runs jobs every hour."""
    while True:
        try:
            with app.app_context():
                run_all_jobs()
        except Exception as e:
            print(f"Scheduler error: {e}")
        time.sleep(3600)  # Run every hour


if __name__ == '__main__':
    # Start background scheduler
    scheduler_thread = threading.Thread(target=scheduler, daemon=True)
    scheduler_thread.start()

    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    app.run(host='0.0.0.0', port=port, debug=debug)
