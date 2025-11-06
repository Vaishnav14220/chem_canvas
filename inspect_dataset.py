from datasets import load_dataset

dataset = load_dataset("smitathkr1/organic_reactions_structured")
print(dataset)
print(dataset['train'].column_names)
print(dataset['train'][0])