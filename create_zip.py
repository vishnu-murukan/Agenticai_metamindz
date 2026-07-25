import os
import zipfile

def create_project_zip():
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    output_zip_path = os.path.join(repo_dir, "..", "reflection_memory_decision_twin.zip")
    output_zip_path = os.path.abspath(output_zip_path)

    print(f"Creating zip archive at: {output_zip_path}")
    
    with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(repo_dir):
            # Skip .git directory and python cache
            if '.git' in root or '__pycache__' in root:
                continue
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, repo_dir)
                zipf.write(file_path, arcname)
                
    print("ZIP package created successfully!")
    print(f"File location: {output_zip_path}")
    print(f"File size: {os.path.getsize(output_zip_path) / 1024:.2f} KB")

if __name__ == "__main__":
    create_project_zip()
