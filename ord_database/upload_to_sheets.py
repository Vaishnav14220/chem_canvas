import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd
import os

def setup_google_sheets():
    """
    Set up Google Sheets API credentials and return authorized client.

    Requires credentials.json file in the same directory.
    """
    # Define the scope
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']

    # Load credentials from JSON file
    creds_file = 'credentials.json'
    if not os.path.exists(creds_file):
        raise FileNotFoundError(f"Credentials file '{creds_file}' not found. Please download it from Google Cloud Console.")

    creds = ServiceAccountCredentials.from_json_keyfile_name(creds_file, scope)

    # Authorize the client
    client = gspread.authorize(creds)

    return client

def upload_csv_to_sheets(csv_file, sheet_name="ORD Reactions Database", share_email=None):
    """
    Upload CSV data to Google Sheets.

    Args:
        csv_file (str): Path to CSV file
        sheet_name (str): Name for the new Google Sheet
        share_email (str): Email to share the sheet with (optional)
    """
    try:
        # Set up Google Sheets client
        client = setup_google_sheets()

        # Read CSV data
        df = pd.read_csv(csv_file)
        print(f"Loaded {len(df)} reactions from {csv_file}")

        # Create new spreadsheet
        spreadsheet = client.create(sheet_name)
        print(f"Created new spreadsheet: {spreadsheet.title}")
        print(f"Spreadsheet URL: {spreadsheet.url}")

        # Get the first worksheet
        worksheet = spreadsheet.get_worksheet(0)

        # Convert DataFrame to list of lists (including headers)
        data = [df.columns.tolist()] + df.values.tolist()

        # Upload data in batches to avoid API limits
        batch_size = 1000
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            if i == 0:
                # First batch includes headers
                worksheet.update(batch)
            else:
                # Subsequent batches (append to existing data)
                worksheet.append_rows(batch)
            print(f"Uploaded batch {i//batch_size + 1} ({len(batch)} rows)")

        # Share the spreadsheet if email provided
        if share_email:
            spreadsheet.share(share_email, perm_type='user', role='writer')
            print(f"Shared spreadsheet with {share_email}")

        return spreadsheet.url

    except Exception as e:
        print(f"Error uploading to Google Sheets: {e}")
        raise

def create_api_script(spreadsheet_id):
    """
    Create a Google Apps Script for the spreadsheet to serve as REST API.

    Args:
        spreadsheet_id (str): ID of the Google Sheet

    Returns:
        str: Instructions for deploying the script
    """
    script_content = f'''function doGet(e) {{
  var sheet = SpreadsheetApp.openById("{spreadsheet_id}").getSheetByName("Sheet1");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var query = e.parameter.query ? e.parameter.query.toLowerCase() : '';

  var results = [];
  for (var i = 1; i < data.length; i++) {{
    var row = data[i];
    // Search in reaction_smiles column (index 3)
    if (!query || (row[3] && row[3].toString().toLowerCase().includes(query))) {{
      var obj = {{}};
      headers.forEach((header, index) => obj[header] = row[index]);
      results.push(obj);
    }}
  }}

  return ContentService
    .createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}}'''

    script_file = "api_script.js"
    with open(script_file, 'w') as f:
        f.write(script_content)

    print(f"Created API script: {script_file}")
    print("\nTo deploy:")
    print("1. Open your Google Sheet")
    print("2. Go to Extensions > Apps Script")
    print("3. Paste the contents of api_script.js")
    print("4. Save and deploy as web app")
    print("5. Set 'Execute as: Me', 'Who has access: Anyone'")
    print("6. Copy the deployment URL for use in your React app")

    return script_content

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python upload_to_sheets.py <csv_file> [sheet_name] [share_email]")
        print("Example: python upload_to_sheets.py reactions.csv 'ORD Database' user@example.com")
        sys.exit(1)

    csv_file = sys.argv[1]
    sheet_name = sys.argv[2] if len(sys.argv) > 2 else "ORD Reactions Database"
    share_email = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        # Upload to Google Sheets
        url = upload_csv_to_sheets(csv_file, sheet_name, share_email)

        # Extract spreadsheet ID from URL
        spreadsheet_id = url.split('/')[5]

        # Create API script
        create_api_script(spreadsheet_id)

        print(f"\nSuccess! Spreadsheet URL: {url}")
        print("Next steps:")
        print("1. Set up Google Cloud Console credentials (see README)")
        print("2. Deploy the Apps Script as instructed above")
        print("3. Use the deployment URL in your React app")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)