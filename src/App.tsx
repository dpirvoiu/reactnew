import {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";

import axios from "axios";
import "./App.css";
import { sortBy } from "lodash";

// DATA FETCHING ENDPOINT
const API_ENDPOINT = "https://hn.algolia.com/api/v1/search?query=";

const useSemiPersistentState = (
  key: string,
  initialState: string
): [string, (newValue: string) => void] => {
  const [value, setValue] = useState(localStorage.getItem(key) || initialState);

  useEffect(() => {
    localStorage.setItem(key, value);
  }, [value, key]);

  return [value, setValue];
};

type Story = {
  objectID: string;
  url: string;
  title: string;
  author: string;
  num_comments: number;
  points: number;
};

type Stories = Array<Story>;

type ItemProps = {
  item: Story;
  onRemoveItem: (id: Story) => void;
};

type StoriesState = {
  data: Stories;
  isLoading: boolean;
  isError: boolean;
};

interface StoriesFetchInitAction {
  type: "STORIES_FETCH_INIT";
}

interface StoriesFetchSuccessAction {
  type: "STORIES_FETCH_SUCCESS";
  payload: Stories;
}

interface StoriesFetchFailureAction {
  type: "STORIES_FETCH_FAILURE";
}

interface StoriesRemoveAction {
  type: "REMOVE_STORY";
  payload: Story;
}

type StoriesAction =
  | StoriesFetchInitAction
  | StoriesFetchSuccessAction
  | StoriesFetchFailureAction
  | StoriesRemoveAction;

// REDUCER FUNCTION !!! to be used inside useReducer hook
const storiesReducer = (state: StoriesState, action: StoriesAction) => {
  switch (action.type) {
    case "STORIES_FETCH_INIT":
      return {
        ...state,
        isLoading: true,
        isError: false,
      };
    case "STORIES_FETCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        isError: false,
        data: action.payload,
      };
    case "STORIES_FETCH_FAILURE":
      return {
        ...state,
        isLoading: false,
        isError: true,
      };
    case "REMOVE_STORY":
      return {
        ...state,
        data: state.data.filter(
          (story) => action.payload.objectID !== story.objectID
        ),
      };
    default:
      return state;
  }
};

const App = () => {
  const [searchTerm, setSearchTerm] = useSemiPersistentState("search", "React");

  const [url, setUrl] = useState(`${API_ENDPOINT}${searchTerm}`);

  // USE REDUCER HOOK, passing initial state and reducer function
  const [stories, dispatchStories] = useReducer(storiesReducer, {
    data: [],
    isLoading: false,
    isError: false,
  });

  const handleSearchInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    setUrl(`${API_ENDPOINT}${searchTerm}`);
    event.preventDefault();
  };

  // ASYNC DATA FETCHING RELATED with useEffect RELATED TO USE REUDCER FUNCTION
  const handleFetchStories = useCallback(async () => {
    if (!searchTerm) return;
    dispatchStories({ type: "STORIES_FETCH_INIT" });

    // B - FETCHING DATA FROM API
    try {
      const result = await axios.get(url);
      dispatchStories({
        type: "STORIES_FETCH_SUCCESS",
        payload: result.data.hits, // D result.hits is the data we want to pass to reducer
      });
    } catch {
      dispatchStories({ type: "STORIES_FETCH_FAILURE" });
    }
  }, [url]);

  useEffect(() => {
    handleFetchStories();
  }, [handleFetchStories]);

  // wrapped inside use callback to prevent re-render of the List component
  const handleRemoveStory = useCallback((item: Story) => {
    dispatchStories({ type: "REMOVE_STORY", payload: item });
  }, []);

  console.log("B: App");

  // Only run on Submit button click
  const sumComments = useMemo(() => GetSumComments(stories), [stories]);

  return (
    <div className="container">
      <h1 className="headline-primary">Hey There with {sumComments}</h1>
      <SearchForm
        searchTerm={searchTerm}
        onSearchInput={handleSearchInput}
        onSearchSubmit={handleSearchSubmit}
      />

      {stories.isError && <p>Something went wrong ...</p>}
      {stories.isLoading ? (
        <p>Loading...</p>
      ) : (
        <List list={stories.data} onRemoveItem={handleRemoveStory} />
      )}
    </div>
  );
};

const GetSumComments = (stories) => {
  return stories.data.reduce(
    (results, value) => results + value.num_comments,
    0
  );
};

type ListProps = {
  list: Stories;
  onRemoveItem: (id: Story) => void;
};

const SORTS = {
  NONE: (list) => list,
  TITLE: (list) => sortBy(list, "title"),
  AUTHOR: (list) => sortBy(list, "author"),
  COMMENT: (list) => sortBy(list, "num_comments").reverse(),
  POINT: (list) => sortBy(list, "points").reverse(),
};

// To prevent re-render of the component, we should use memo api and wrap the parameters inside a useCallback
const List = memo(({ list, onRemoveItem }: ListProps) => {
  // SORT and Sort reverse
  const [sort, setSort] = useState({ sortKey: "NONE", isReverse: false });

  const handleSort = (sortKey) => {
    const isReverse = sort.sortKey === sortKey && !sort.isReverse;
    setSort({ sortKey: sortKey, isReverse: isReverse });
  };

  const sortFunction = SORTS[sort.sortKey];
  const sortedList = sort.isReverse
    ? sortFunction(list).reverse()
    : sortFunction(list);

  return (
    <ul>
      <li style={{ display: "flex" }}>
        <span style={{ width: "40%" }}>
          <button type="button" onClick={() => handleSort("TITLE")}>
            Title
          </button>
        </span>
        <span style={{ width: "30%" }}>
          <button type="button" onClick={() => handleSort("AUTHOR")}>
            Author
          </button>
        </span>
        <span style={{ width: "15%" }}>
          <button type="button" onClick={() => handleSort("COMMENT")}>
            Comments
          </button>
        </span>
        <span style={{ width: "10%" }}>
          <button type="button" onClick={() => handleSort("POINT")}>
            Points
          </button>
        </span>
        <span style={{ width: "10%" }}>Actions</span>
      </li>
      {sortedList.map((item) => (
        <Item key={item.objectID} item={item} onRemoveItem={onRemoveItem} />
      ))}
    </ul>
  );
});

const Item = ({ item, onRemoveItem }: ItemProps) => {
  const handleRemoveItem = () => {
    onRemoveItem(item);
  };

  return (
    <li className="item" style={{ display: "flex" }}>
      <span style={{ width: "40%" }}>
        <a href={item.url}>{item.title}</a>
      </span>
      <span style={{ width: "30%" }}>{item.author}</span>
      <span style={{ width: "10%" }}>{item.num_comments}</span>
      <span style={{ width: "10%" }}>{item.points}</span>
      <span style={{ width: "10%" }}>
        <button
          type="button"
          onClick={handleRemoveItem}
          className="button-small"
        >
          Remove
        </button>
      </span>
    </li>
  );
};

type InputWithLabelProps = {
  id: string;
  value: string;
  type?: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isFocused?: boolean;
  children: React.ReactNode;
};

const InputWithLabel = ({
  onInputChange,
  value,
  id,
  type = "text",
  children,
  isFocused = false,
}: InputWithLabelProps) => {
  const inputRef = useRef<HTMLInputElement>(null!);
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  return (
    <>
      <label htmlFor={id} className="label">
        {children}
      </label>
      &nbsp;
      <input
        id={id}
        ref={inputRef}
        value={value}
        type={type}
        onChange={onInputChange}
        className="input"
      />
      <p>
        Search term: <strong>{value}</strong>
      </p>
    </>
  );
};

type SearchFormProps = {
  searchTerm: string;
  onSearchInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

const SearchForm = ({
  onSearchInput,
  onSearchSubmit,
  searchTerm,
}: SearchFormProps) => {
  return (
    <form onSubmit={onSearchSubmit} className="search-form">
      <InputWithLabel
        id="search"
        isFocused
        onInputChange={onSearchInput}
        value={searchTerm}
      >
        <strong>Search:</strong>
      </InputWithLabel>
      <button type="submit" disabled={!searchTerm} className="button_large">
        Submit
      </button>
    </form>
  );
};

export default App;

export { storiesReducer, SearchForm, InputWithLabel, List, Item };
